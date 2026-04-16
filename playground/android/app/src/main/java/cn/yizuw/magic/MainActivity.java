package cn.yizuw.magic;

import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;
import android.text.TextUtils;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.tencent.mm.opensdk.modelmsg.SendMessageToWX;
import com.tencent.mm.opensdk.modelmsg.WXMediaMessage;
import com.tencent.mm.opensdk.modelmsg.WXWebpageObject;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    @Override
    public void onStart() {
        super.onStart();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            boolean isDebuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            if (isDebuggable) {
                WebView.setWebContentsDebuggingEnabled(true);
            }
        }

        // 添加 JavaScript 接口
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AndroidInterface(), "AndroidInterface");
        }
    }

    private Bitmap decodeWechatThumbBitmap(String thumbUrl) {
        if (TextUtils.isEmpty(thumbUrl)) {
            return null;
        }

        HttpURLConnection connection = null;
        InputStream inputStream = null;
        try {
            URL url = new URL(thumbUrl);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("User-Agent", "MagicAndroid/1.0");
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                return null;
            }

            inputStream = connection.getInputStream();
            return BitmapFactory.decodeStream(inputStream);
        } catch (Exception error) {
            return null;
        } finally {
            if (inputStream != null) {
                try {
                    inputStream.close();
                } catch (Exception ignored) {
                }
            }
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private byte[] buildWechatThumbData(String thumbUrl) {
        Bitmap sourceBitmap = decodeWechatThumbBitmap(thumbUrl);
        if (sourceBitmap == null) {
            sourceBitmap = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
        }

        if (sourceBitmap == null) {
            return null;
        }

        Bitmap scaledBitmap = Bitmap.createScaledBitmap(sourceBitmap, 120, 120, true);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        int quality = 90;
        do {
            output.reset();
            scaledBitmap.compress(Bitmap.CompressFormat.JPEG, quality, output);
            quality -= 10;
        } while (output.size() > 32 * 1024 && quality > 10);

        if (scaledBitmap != sourceBitmap) {
            scaledBitmap.recycle();
        }
        sourceBitmap.recycle();

        return output.toByteArray();
    }

    private String buildShareResult(boolean ok, String reason, String message) {
        try {
            JSONObject result = new JSONObject();
            result.put("message", message == null ? "" : message);
            result.put("ok", ok);
            result.put("reason", reason == null ? "" : reason);
            return result.toString();
        } catch (Exception error) {
            return "{\"ok\":false,\"reason\":\"json-error\",\"message\":\"生成分享结果失败\"}";
        }
    }

    private String buildWechatTransaction(String type) {
        return type + ":" + UUID.randomUUID();
    }

    private boolean containsIgnoreCase(String value, String keyword) {
        if (TextUtils.isEmpty(value) || TextUtils.isEmpty(keyword)) {
            return false;
        }
        return value.toUpperCase(Locale.ROOT).contains(keyword.toUpperCase(Locale.ROOT));
    }

    private boolean isHuaweiDevice() {
        return containsIgnoreCase(Build.MANUFACTURER, "HUAWEI")
            || containsIgnoreCase(Build.BRAND, "HUAWEI");
    }

    private boolean isHonorDevice() {
        return containsIgnoreCase(Build.MANUFACTURER, "HONOR")
            || containsIgnoreCase(Build.BRAND, "HONOR");
    }

    private boolean isHuaweiFamilyDevice() {
        return isHuaweiDevice() || isHonorDevice();
    }

    private String getVendorType() {
        if (isHonorDevice()) {
            return "honor";
        }
        if (isHuaweiDevice()) {
            return "huawei";
        }
        return "other";
    }

    private String buildDeviceVendorResult() {
        try {
            JSONObject result = new JSONObject();
            result.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
            result.put("brand", Build.BRAND == null ? "" : Build.BRAND);
            result.put("isHuaweiFamily", isHuaweiFamilyDevice());
            result.put("vendorType", getVendorType());
            return result.toString();
        } catch (Exception error) {
            return "{\"manufacturer\":\"\",\"brand\":\"\",\"isHuaweiFamily\":false,\"vendorType\":\"other\"}";
        }
    }

    private boolean startFirstAvailableIntent(Intent[] intents) {
        for (Intent intent : intents) {
            if (intent == null) {
                continue;
            }
            try {
                startActivity(intent);
                return true;
            } catch (Exception ignored) {
            }
        }

        return false;
    }

    private boolean openHuaweiAppMarketDetailPage() {
        String packageName = getPackageName();

        Intent detailIntent = new Intent("com.huawei.appmarket.intent.action.AppDetail");
        detailIntent.setPackage("com.huawei.appmarket");
        detailIntent.putExtra("APP_PACKAGENAME", packageName);
        detailIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        Intent schemeIntent = new Intent(
            Intent.ACTION_VIEW,
            Uri.parse("appmarket://details?id=" + packageName)
        );
        schemeIntent.setPackage("com.huawei.appmarket");
        schemeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage("com.huawei.appmarket");
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        return startFirstAvailableIntent(new Intent[] {detailIntent, schemeIntent, launchIntent});
    }

    private boolean openHonorAppMarketDetailPage() {
        String packageName = getPackageName();

        Intent detailIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + packageName));
        detailIntent.setPackage("com.hihonor.appmarket");
        detailIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

        Intent launchIntent = getPackageManager().getLaunchIntentForPackage("com.hihonor.appmarket");
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        return startFirstAvailableIntent(new Intent[] {detailIntent, launchIntent});
    }

    private boolean openGenericAppMarketDetailPage() {
        Intent intent = new Intent(
            Intent.ACTION_VIEW,
            Uri.parse("market://details?id=" + getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return startFirstAvailableIntent(new Intent[] {intent});
    }

    private boolean openPreferredAppMarketDetailPage() {
        if (isHonorDevice()) {
            if (openHonorAppMarketDetailPage()) {
                return true;
            }
            if (openHuaweiAppMarketDetailPage()) {
                return true;
            }
        } else if (isHuaweiDevice() && openHuaweiAppMarketDetailPage()) {
            return true;
        }

        return openGenericAppMarketDetailPage();
    }

    /**
     * Android 原生接口类
     */
    public class AndroidInterface {

        @JavascriptInterface
        public boolean isWechatInstalled(String appId) {
            if (TextUtils.isEmpty(appId)) {
                return false;
            }

            IWXAPI api = WXAPIFactory.createWXAPI(MainActivity.this, appId, true);
            api.registerApp(appId);
            return api.isWXAppInstalled();
        }

        @JavascriptInterface
        public String getDeviceVendorInfo() {
            return buildDeviceVendorResult();
        }

        @JavascriptInterface
        public boolean openAppMarket() {
            return openPreferredAppMarketDetailPage();
        }

        @JavascriptInterface
        public String shareWechatWebpage(String payloadJson) {
            AtomicReference<String> resultRef = new AtomicReference<>(
                buildShareResult(false, "unknown", "原生微信分享未执行")
            );
            CountDownLatch latch = new CountDownLatch(1);
            new Thread(() -> {
                try {
                    JSONObject payload = new JSONObject(payloadJson);
                    String appId = payload.optString("appId");
                    String thumbUrl = payload.optString("thumbUrl");
                    String title = payload.optString("title");
                    String description = payload.optString("description");
                    String url = payload.optString("url");
                    String scene = payload.optString("scene", "session");

                    if (TextUtils.isEmpty(appId) || TextUtils.isEmpty(title) || TextUtils.isEmpty(url)) {
                        resultRef.set(
                            buildShareResult(false, "invalid-params", "微信分享参数不完整")
                        );
                        latch.countDown();
                        return;
                    }

                    byte[] thumbData = buildWechatThumbData(thumbUrl);

                    runOnUiThread(() -> {
                        try {
                            IWXAPI api = WXAPIFactory.createWXAPI(MainActivity.this, appId, true);
                            api.registerApp(appId);

                            if (!api.isWXAppInstalled()) {
                                resultRef.set(
                                    buildShareResult(false, "wechat-not-installed", "未安装微信")
                                );
                                return;
                            }

                            WXWebpageObject webpage = new WXWebpageObject();
                            webpage.webpageUrl = url;

                            WXMediaMessage message = new WXMediaMessage(webpage);
                            message.title = title;
                            message.description = description;

                            if (thumbData != null && thumbData.length > 0) {
                                message.thumbData = thumbData;
                            }

                            SendMessageToWX.Req req = new SendMessageToWX.Req();
                            req.transaction = buildWechatTransaction("webpage");
                            req.message = message;
                            req.scene = "timeline".equals(scene)
                                ? SendMessageToWX.Req.WXSceneTimeline
                                : SendMessageToWX.Req.WXSceneSession;

                            boolean sent = api.sendReq(req);
                            resultRef.set(
                                buildShareResult(
                                    sent,
                                    sent ? "ok" : "send-failed",
                                    sent ? "已拉起微信" : "拉起微信失败"
                                )
                            );
                        } catch (Exception error) {
                            resultRef.set(
                                buildShareResult(
                                    false,
                                    "native-exception",
                                    error.getMessage() == null ? "调用微信分享失败" : error.getMessage()
                                )
                            );
                        } finally {
                            latch.countDown();
                        }
                    });
                } catch (Exception error) {
                    resultRef.set(
                        buildShareResult(
                            false,
                            "native-exception",
                            error.getMessage() == null ? "调用微信分享失败" : error.getMessage()
                        )
                    );
                    latch.countDown();
                }
            }).start();

            try {
                boolean completed = latch.await(10, TimeUnit.SECONDS);
                if (!completed) {
                    return buildShareResult(false, "timeout", "原生微信分享超时");
                }
            } catch (InterruptedException error) {
                Thread.currentThread().interrupt();
                return buildShareResult(false, "interrupted", "原生微信分享被中断");
            }

            return resultRef.get();
        }

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
