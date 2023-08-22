import {spawn} from 'child_process';
import DefaultRenditions from './default-renditions';
import fs from 'fs';

class Transcode {
    inputPath: string;
    outputPath: string;
    options: any | undefined;
	id: string | undefined;
	onProgress: (arg0: string) => void;

	constructor(inputPath : string, outputPath : string, options : any, id: string, onProgress: (arg0: string) => void){
        this.inputPath = inputPath;
        this.outputPath = outputPath;
        this.options = options || {};
		this.id = id || "";
		this.onProgress = onProgress || function(arg0: string){}
    }

    transcode(){
      return new Promise(async (resolve, reject) =>  {
        const commands : any  = await this.buildCommands();
        const masterPlaylist = await this.writePlaylist();
        const ffmpeg = this.options.ffmpegPath ? spawn(this.options.ffmpegPath, commands) : spawn('ffmpeg', commands)
        let showLogs = true;
        if (this.options.showLogs == false){
          showLogs = false;
        }
        ffmpeg.stdout.on('data', (data: any) =>  {
			this.onProgress(data.toString())
          if (showLogs){
            console.log(this.id, data.toString());
          }
        });

        ffmpeg.stderr.on('data', (data: any) =>  {
			this.onProgress(data.toString())
          if (showLogs){
            console.log(this.id, data.toString());
          }
        });

        ffmpeg.on('exit', (code: any) =>  {
          if (showLogs){
            console.log(this.id, `Child exited with code ${code}`);
          }
          if (code == 0) return resolve(masterPlaylist);

          return reject('Video Failed to Transcode');
          
        })
      })
    }

    buildCommands(){
      return new Promise((resolve, reject) =>  {
        let commands = ['-hide_banner', '-y', '-i', this.inputPath];
        const renditions = this.options.renditions || DefaultRenditions;
        for (let i = 0, len = renditions.length; i < len; i++){
          const r = renditions[i];
          commands = commands.concat(['-vf', `scale=w=${r.width}:h=${r.height}:force_original_aspect_ratio=decrease`, '-c:a', 'aac', '-ar', '48000', '-c:v', 'h264', `-profile:v`, r.profile, '-crf', '20', '-sc_threshold', '0', '-g', '48', '-hls_time', r.hlsTime, '-hls_playlist_type', 'vod', '-b:v', r.bv, '-maxrate', r.maxrate, '-bufsize', r.bufsize, '-b:a', r.ba, '-hls_segment_filename', `${this.outputPath}/${r.ts_title}_%03d.ts`, `${this.outputPath}/${r.height}.m3u8`])
        }
         resolve(commands);
      })
    }

    writePlaylist(){
      return new Promise(async (resolve, reject) =>  {
       let m3u8Playlist =  `#EXTM3U
#EXT-X-VERSION:3`;
        const renditions = this.options.renditions || DefaultRenditions;
        
        for (let i = 0, len = renditions.length; i < len; i++){
          const r = renditions[i];
          m3u8Playlist += `
#EXT-X-STREAM-INF:BANDWIDTH=${r.bv.replace('k', '000')},RESOLUTION=${r.width}x${r.height}
${r.height}.m3u8`
        }
        const m3u8Path = `${this.outputPath}/index.m3u8`
        fs.writeFileSync(m3u8Path, m3u8Playlist);

        resolve(m3u8Path);

      })
    }
}

export const Transcoder = Transcode;


/*
const t = new Transcoder(`${__dirname}/test.mp4`, `${__dirname}/output`, {});
t.transcode();
*/