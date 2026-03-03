let scriptPromise: null | Promise<void> = null;

export function loadBaiduMapScript(ak: string): Promise<void> {
  if ((window as any).BMap) {
    return Promise.resolve();
  }

  if (scriptPromise) {
    return scriptPromise;
  }

  scriptPromise = new Promise((resolve, reject) => {
    const callbackName = 'onBaiduMapLoaded';
    const timeoutMs = 12_000;
    const scriptSrc = `https://api.map.baidu.com/api?v=3.0&ak=${encodeURIComponent(ak)}&callback=${callbackName}`;
    let timeoutId: null | number = null;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      (window as any)[callbackName] = undefined;

      if (error) {
        scriptPromise = null; // Reset on error
        reject(error);
        return;
      }
      resolve();
    };

    (window as any)[callbackName] = () => {
      finish();
    };

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = scriptSrc;
    script.async = true;
    script.defer = true;
    script.addEventListener('error', (e) => {
      const reason =
        e instanceof ErrorEvent
          ? e.message || 'script error'
          : 'script load error';
      finish(
        new Error(
          `百度地图脚本加载失败(${reason})，src=${scriptSrc}，page=${window.location.href}`,
        ),
      );
    });
    document.head.append(script);

    timeoutId = window.setTimeout(() => {
      finish(
        new Error(
          `百度地图脚本加载超时(${timeoutMs}ms)，src=${scriptSrc}，page=${window.location.href}`,
        ),
      );
    }, timeoutMs);
  });

  return scriptPromise;
}
