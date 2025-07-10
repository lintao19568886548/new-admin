package cn.yizuw.magic;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.webkit.JavascriptInterface;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onStart() {
        super.onStart();
        
        // 添加 JavaScript 接口
        getBridge().getWebView().addJavascriptInterface(new AndroidInterface(), "AndroidInterface");
    }
    
    /**
     * Android 原生接口类
     */
    public class AndroidInterface {
        
        /**
         * 安装 APK 文件
         * @param fileUri 文件的 file:// URI
         * @param fileName 文件名
         */
        @JavascriptInterface
        public void installApk(String fileUri, String fileName) {
            try {
                // 将 file:// URI 转换为 File 对象
                Uri uri = Uri.parse(fileUri);
                File apkFile = new File(uri.getPath());
                
                if (!apkFile.exists()) {
                    return;
                }
                
                Intent intent = new Intent(Intent.ACTION_VIEW);
                Uri apkUri;
                
                // Android 7.0 及以上使用 FileProvider
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    apkUri = FileProvider.getUriForFile(
                        MainActivity.this,
                        getPackageName() + ".fileprovider",
                        apkFile
                    );
                    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } else {
                    apkUri = Uri.fromFile(apkFile);
                }
                
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                
                startActivity(intent);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
