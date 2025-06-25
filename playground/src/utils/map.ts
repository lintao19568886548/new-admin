export function loadBaiduMapScript(ak: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).BMap) {
      resolve();
      return;
    }

    (window as any).onBaiduMapLoaded = () => {
      resolve();
      // Clean up
      delete (window as any).onBaiduMapLoaded;
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = `//api.map.baidu.com/api?v=3.0&ak=${ak}&callback=onBaiduMapLoaded`;
    script.addEventListener('error', (e) => reject(e));
    document.head.append(script);
  });
}
