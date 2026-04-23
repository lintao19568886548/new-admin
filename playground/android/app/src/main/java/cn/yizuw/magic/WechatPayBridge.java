package cn.yizuw.magic;

import android.content.Context;
import android.content.SharedPreferences;
import android.text.TextUtils;
import java.lang.ref.WeakReference;

public final class WechatPayBridge {

    private static final String PREFS_NAME = "wechat_pay_bridge";
    private static final String PREF_WECHAT_APP_ID = "wechat_open_app_id";

    private static WeakReference<MainActivity> activityReference = new WeakReference<>(null);
    private static String pendingPayResultJson = null;

    private WechatPayBridge() {}

    public static synchronized void attachActivity(MainActivity activity) {
        activityReference = new WeakReference<>(activity);
    }

    public static synchronized void clearPendingPayResult() {
        pendingPayResultJson = null;
    }

    public static synchronized void detachActivity(MainActivity activity) {
        MainActivity attachedActivity = activityReference.get();
        if (attachedActivity == activity) {
            activityReference = new WeakReference<>(null);
        }
    }

    public static void flushPendingPayResult() {
        MainActivity activity;
        String resultJson;

        synchronized (WechatPayBridge.class) {
            activity = activityReference.get();
            resultJson = pendingPayResultJson;
            if (activity == null || TextUtils.isEmpty(resultJson)) {
                return;
            }
        }

        if (activity.emitWechatPayResult(resultJson)) {
            synchronized (WechatPayBridge.class) {
                pendingPayResultJson = null;
            }
        }
    }

    public static String getStoredAppId(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        );
        return preferences.getString(PREF_WECHAT_APP_ID, "");
    }

    public static void publishPayResult(String resultJson) {
        MainActivity activity;
        synchronized (WechatPayBridge.class) {
            pendingPayResultJson = resultJson;
            activity = activityReference.get();
        }

        if (activity != null) {
            if (activity.emitWechatPayResult(resultJson)) {
                synchronized (WechatPayBridge.class) {
                    pendingPayResultJson = null;
                }
            }
        }
    }

    public static void saveAppId(Context context, String appId) {
        context
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_WECHAT_APP_ID, appId)
            .apply();
    }
}
