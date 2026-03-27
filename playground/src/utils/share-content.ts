import type { NativeWechatShareOptions } from './native-wechat-share';

export interface PageShareContent {
  description?: string;
  imageUrl?: string;
  title: string;
  url: string;
  webPath?: string;
  webQuery?: Record<string, boolean | number | string> | string;
}

export type MiniProgramShareContent = Partial<
  Pick<PageShareContent, 'imageUrl' | 'title' | 'webPath' | 'webQuery'>
>;

export type MiniProgramShareMessage = {
  payload?: MiniProgramShareContent;
  type: 'SHARE_CONFIG';
};

export function buildHeadShareMetadata(content: PageShareContent) {
  const description = content.description || '';
  const imageUrl = content.imageUrl || '';

  return {
    meta: [
      {
        content: description,
        name: 'description',
      },
      {
        content: description,
        property: 'og:description',
      },
      {
        content: imageUrl,
        property: 'og:image',
      },
      {
        content: content.title,
        property: 'og:title',
      },
      {
        content: content.url,
        property: 'og:url',
      },
    ],
    title: content.title,
  };
}

export function buildMiniProgramShareMessage(
  content: MiniProgramShareContent,
): MiniProgramShareMessage {
  const payload: MiniProgramShareContent = {};

  if (content.title !== undefined) {
    payload.title = content.title;
  }

  if (content.imageUrl !== undefined) {
    payload.imageUrl = content.imageUrl;
  }

  if (content.webPath !== undefined) {
    payload.webPath = content.webPath;
  }

  if (content.webQuery !== undefined) {
    payload.webQuery = content.webQuery;
  }

  return {
    payload,
    type: 'SHARE_CONFIG',
  };
}

export function buildNativeWechatShareOptions(
  content: PageShareContent,
  options: Partial<Pick<NativeWechatShareOptions, 'scene'>> &
    Pick<NativeWechatShareOptions, 'appId'>,
): NativeWechatShareOptions {
  return {
    appId: options.appId,
    description: content.description,
    scene: options.scene,
    thumbUrl: content.imageUrl,
    title: content.title,
    url: content.url,
  };
}
