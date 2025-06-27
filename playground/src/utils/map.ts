let scriptPromise: null | Promise<void> = null;

export function loadBaiduMapScript(ak: string): Promise<void> {
  if ((window as any).BMap) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    (window as any).onBaiduMapLoaded = () => {
      resolve();
      // Clean up
      delete (window as any).onBaiduMapLoaded;
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `//api.map.baidu.com/api?v=3.0&ak=${ak}&callback=onBaiduMapLoaded`;
    script.addEventListener('error', (e) => {
      scriptPromise = null; // Reset on error
      reject(e);
    });
    document.head.append(script);
  });

  return scriptPromise;
}
