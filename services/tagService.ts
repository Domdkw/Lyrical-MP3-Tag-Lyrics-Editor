
import { MP3Metadata, LyricLine } from '../types';

// jsmediatags is loaded via CDN in index.html
declare const jsmediatags: any;

export const parseMetadata = (file: File): Promise<MP3Metadata> => {
  return new Promise((resolve, reject) => {
    jsmediatags.read(file, {
      onSuccess: (tag: any) => {
        const { tags } = tag;
        let pictureUrl = '';
        let rawPicture: ArrayBuffer | undefined = undefined;
        let pictureMime = '';
        
        if (tags.picture) {
          const { data, format } = tags.picture;
          pictureMime = format;
          
          // 转换为 Uint8Array 然后到 ArrayBuffer
          const uint8 = new Uint8Array(data);
          rawPicture = uint8.buffer;

          // 为 UI 显示创建 Base64
          let base64String = "";
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          pictureUrl = `data:${format};base64,${window.btoa(base64String)}`;
        }

        // 处理歌词 (USLT 帧)
        let lyrics = tags.lyrics?.lyrics || tags.USLT?.data?.lyrics || "";

        resolve({
          title: tags.title || file.name.replace(/\.[^/.]+$/, ""),
          artist: tags.artist || 'Unknown Artist',
          album: tags.album || 'Unknown Album',
          year: tags.year || '',
          genre: tags.genre || '',
          picture: pictureUrl,
          rawPicture: rawPicture,
          pictureMime: pictureMime,
          lyrics: lyrics,
        });
      },
      onError: (error: any) => {
        reject(error);
      }
    });
  });
};

export const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `[${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
};

export const parseLrc = (lrcContent: string): LyricLine[] => {
  if (!lrcContent) return [];
  const lines = lrcContent.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  lines.forEach((line, index) => {
    const match = line.match(timeRegex);
    if (match) {
      const mins = parseInt(match[1]);
      const secs = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const time = mins * 60 + secs + ms / (match[3].length === 3 ? 1000 : 100);
      const text = line.replace(timeRegex, '').trim();
      result.push({ id: `line-${index}-${Date.now()}`, time, text });
    } else {
      const text = line.trim();
      if (text) {
        result.push({ id: `line-${index}-${Date.now()}`, time: -1, text });
      }
    }
  });

  return result.sort((a, b) => (a.time === -1 ? 1 : b.time === -1 ? -1 : a.time - b.time));
};

export const serializeLrc = (lines: LyricLine[]): string => {
  return lines
    .filter(l => l.text.trim() !== '')
    .map(l => `${l.time >= 0 ? formatTime(l.time) : '[00:00.00]'} ${l.text}`)
    .join('\n');
};
