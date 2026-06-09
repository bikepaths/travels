import asyncio
import pathlib
import json
import sys
import datetime
from telethon import TelegramClient
from telethon.tl.types import MessageService

api_id = 38135926
api_hash = '5b5a547fa05c3bcb3ad96e21b988d2f4'
session_path = pathlib.Path('/home/user0/git/private/telegram/system/session/session_name')
base_dir = pathlib.Path('/home/user0/git/travels')

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 # 15MB

targets = [
    {"id": -1001386344823, "slug": "travels_w_chas", "type": "channels", "name": "Travels w/Chas"},
    {"id": -1001228350086, "slug": "bikepaths_2018_archive", "type": "groups", "name": "Bikepaths 2018 (Archive)"},
    {"id": -1001426285724, "slug": "bikepaths_posts", "type": "groups", "name": "Bikepaths Posts"},
    {"id": -1001031272819, "slug": "bikepaths_2016_17", "type": "groups", "name": "Bikepaths 2016-17"},
    {"id": -1001119595758, "slug": "bikepaths", "type": "groups", "name": "Bikepaths"}
]

def get_media_size(media):
    if not media:
        return 0
    if hasattr(media, 'document') and media.document:
        return getattr(media.document, 'size', 0)
    if hasattr(media, 'photo') and media.photo:
        sizes = getattr(media.photo, 'sizes', [])
        if sizes:
            photo_sizes = [getattr(s, 'size', 0) for s in sizes if hasattr(s, 'size')]
            return max(photo_sizes) if photo_sizes else 0
    if hasattr(media, 'webpage') and media.webpage:
        return get_media_size(media.webpage)
    return 0

async def download_msg_media(client, msg, dest_dir):
    if not msg.media:
        return None
        
    # Check file size to prevent repository bloat
    media_size = get_media_size(msg.media)
    if media_size > MAX_FILE_SIZE_BYTES:
        print(f"Skipping large attachment in message {msg.id} ({media_size / (1024*1024):.1f} MB exceeds 15MB limit)")
        return None
        
    # Attempt to extract original filename
    filename = None
    if hasattr(msg.media, 'document') and msg.media.document:
        for attr in getattr(msg.media.document, 'attributes', []):
            if hasattr(attr, 'file_name') and attr.file_name:
                filename = attr.file_name
                break
                
    if not filename:
        ext = ".jpg"
        if hasattr(msg.media, 'document') and msg.media.document and msg.media.document.mime_type:
            mime = msg.media.document.mime_type
            if '/' in mime:
                ext = f".{mime.split('/')[1]}"
        filename = f"{msg.id}{ext}"
    else:
        # Clean special characters from filename
        filename = "".join(c for c in filename if c.isalnum() or c in "._- ")
        filename = f"{msg.id}_{filename}"
        
    target_file = dest_dir / filename
    if not target_file.exists():
        try:
            print(f"Downloading media to {target_file.name}...")
            await client.download_media(msg, file=str(target_file))
        except Exception as e:
            print(f"Failed to download media for message {msg.id}: {e}")
            return None
    return filename

async def process_target(client, t):
    print(f"\nProcessing target: {t['name']} ({t['id']})...")
    
    # Define directories
    data_dir = base_dir / "data" / t["type"] / t["slug"]
    media_dir = base_dir / "media" / t["slug"]
    
    data_dir.mkdir(parents=True, exist_ok=True)
    media_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        entity = await client.get_entity(t["id"])
    except Exception as e:
        print(f"Could not resolve entity for ID {t['id']}: {e}")
        return
        
    # 1. Fetch all messages first
    print("Fetching message history...")
    messages = []
    async for msg in client.iter_messages(entity):
        if isinstance(msg, MessageService) or not msg.date:
            continue
        messages.append(msg)
    print(f"Fetched {len(messages)} messages.")
    
    # 2. Concurrently process messages and download media
    sem = asyncio.Semaphore(10) # Max 10 concurrent downloads
    
    async def process_message(msg):
        async with sem:
            media_file = await download_msg_media(client, msg, media_dir)
            
            sender = "unknown"
            if msg.sender:
                sender = getattr(msg.sender, 'username', None) or getattr(msg.sender, 'first_name', 'unknown')
                
            return {
                "id": msg.id,
                "date": msg.date.isoformat(),
                "from": sender,
                "text": msg.text or "",
                "media": media_file,
                "date_obj": msg.date # Temporary for sorting
            }
            
    print("Downloading media and parsing messages concurrently...")
    tasks = [process_message(m) for m in messages]
    processed_msgs = await asyncio.gather(*tasks)
    
    # Group messages by month (YYYY_MM)
    monthly_data = {}
    for pm in processed_msgs:
        month_key = pm["date_obj"].strftime("%Y_%m")
        # Strip temporary key
        entry = {
            "id": pm["id"],
            "date": pm["date"],
            "from": pm["from"],
            "text": pm["text"],
            "media": pm["media"]
        }
        if month_key not in monthly_data:
            monthly_data[month_key] = []
        monthly_data[month_key].append(entry)
        
    # Sort messages chronologically
    for m in monthly_data:
        monthly_data[m].reverse()
        
    # Write monthly JSON files
    months_list = []
    for month_key, msgs in monthly_data.items():
        month_str = month_key.replace('_', '-') # YYYY-MM
        months_list.append(month_str)
        
        file_path = data_dir / f"messages_{month_key}.json"
        with file_path.open('w') as f:
            json.dump(msgs, f, indent=2, ensure_ascii=False)
            
    months_list.sort()
    
    # Write metadata.json
    metadata = {
        "id": t["id"],
        "slug": t["slug"],
        "type": t["type"],
        "name": t["name"],
        "months": months_list,
        "total_messages": len(processed_msgs),
        "last_updated": datetime.datetime.now().isoformat()
    }
    
    metadata_path = data_dir / "metadata.json"
    with metadata_path.open('w') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
        
    print(f"Finished {t['name']}. Total Messages: {metadata['total_messages']}. Files written to {data_dir}")

async def main():
    client = TelegramClient(str(session_path), api_id, api_hash)
    await client.start()
    
    try:
        base_dir.mkdir(parents=True, exist_ok=True)
        (base_dir / "scripts").mkdir(exist_ok=True)
        
        for t in targets:
            await process_target(client, t)
            
        print("\nAll travel targets successfully extracted concurrently.")
        
    except Exception as e:
        print(f"Error during extraction: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        await client.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
