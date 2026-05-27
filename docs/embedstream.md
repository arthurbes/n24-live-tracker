---
title: Embed Stream
parent: Home
nav_order: 3
---

# Embedding a YouTube Stream
![embed preview](/assets/EMBED_PREVIEW.png)
## Initial set-up

1. View the video's embed code via[ this guide.](https://support.google.com/youtube/answer/171780?hl=en)
2. Copy the highlighted text from within the embed snippet. <br>
![n24-live-tracker demo](/assets/GET_STREAMURL_FROM_EMBED.png)
3. Set in `.env`:
   ```bash
   STREAMURL=YOURSTREAMURL
   ```
4. Restart container:
   ```bash
   docker-compose up -d
   ```

#### Without a STREAMURL value, The stream window will not display.
