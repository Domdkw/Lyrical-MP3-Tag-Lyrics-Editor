
export interface LyricLine {
  id: string;
  time: number; // in seconds
  text: string;
}

export interface MP3Metadata {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  picture?: string; // Base64 用于 UI 显示
  rawPicture?: ArrayBuffer; // 原始图像字节，用于写入
  pictureMime?: string; // 图像 MIME 类型 (例如 'image/jpeg')
  lyrics?: string;
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
}
