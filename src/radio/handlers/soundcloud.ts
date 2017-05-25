import { parse as parseUrl } from 'url';
import * as fetch from 'node-fetch';

import { Writable } from 'stream';
import { HandlerImpl, SongInfo } from '../handlers';

export default class SoundCloud implements HandlerImpl {
  static match(link: string) {
    return false; // TODO
    const parse = parseUrl(link);
    return (parse.hostname === 'snd.sc' || /(www\.)?soundcloud\.com/.test(parse.hostname));
  }

  stream_url: string;

  constructor(public link: string) {
  }

  getMeta(cb: (error: Error, song?: SongInfo) => void) {
    request({
      url: 'https://api.soundcloud.com/resolve',
      qs: { url: this.link, client_id: SOUNDCLOUD_KEY },
    }, (err, res, data) => {
      // check request() error
      if (err) return cb(err);

      // check api error
      if (res.statusCode !== 200) {
        let errmsg = 'HTTP status code: ' + res.statusCode;
        try {
          data = JSON.parse(data);
          errmsg = data.errors[0].error_message;
        } catch (e) {
        }
        return cb(new Error('SoundCloud API error - ' + errmsg));
      }

      // check json error
      try {
        data = JSON.parse(data);
      } catch (e) {
        return cb(e);
      }

      // check if streamable track
      if (data.kind !== 'track') return cb(new Error('URL is not a track'));
      if (!data.streamable) return cb(new Error('Track is not streamable'));
      if (!data.stream_url) return cb(new Error('No stream URL found'));

      this.stream_url = data.stream_url;

      cb(null, {
        id: data.id,
        title: data.title,
        url: data.permalink_url,
        image: data.artwork_url || data.user.avatar_url,
        duration: Math.floor(data.duration / 1000),
        plays: data.playback_count,
        uploader: {
          name: data.user.username,
          url: data.user.permalink_url,
        },
      });
    });
  }

  download(stream: Writable) {
    return (
      request({ url: this.stream_url, qs: { client_id: SOUNDCLOUD_KEY } })
        .pipe(stream)
    );
  }
};
