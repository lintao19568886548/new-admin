package cn.yizuw.magic.wxapi;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import cn.yizuw.magic.MainActivity;
import cn.yizuw.magic.WechatPayBridge;
import com.tencent.mm.opensdk.constants.ConstantsAPI;
import com.tencent.mm.opensdk.modelbase.BaseReq;
import com.tencent.mm.opensdk.modelbase.BaseResp;
import com.tencent.mm.opensdk.openapi.IWXAPI;
import com.tencent.mm.opensdk.openapi.IWXAPIEventHandler;
import com.tencent.mm.opensdk.openapi.WXAPIFactory;
import org.json.JSONObject;

public class WXPayEntryActivity extends Activity implements IWXAPIEventHandler {

    private IWXAPI api;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        initApi();
        handleWechatIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWechatIntent(intent);
    }

    private String buildPayResult(
        boolean ok,
        int errCode,
        String reason,
        String message,
        String errStr,
        String transaction
    ) {
        try {
            JSONObject result = new JSONObject();
            result.put("errCode", errCode);
            result.put("errStr", errStr == null ? "" : errStr);
            result.put("launched", true);
            result.put("message", message == null ? "" : message);
            result.put("ok", ok);
            result.put("reason", reason == null ? "" : reason);
            result.put("transaction", transaction == null ? "" : transaction);
            return result.toString();
        } catch (Exception error) {
            return "{\"ok\":false,\"reason\":\"json-error\",\"message\":\"生成微信支付结果失败\",\"errCode\":-1}";
        }
    }

    private void finishToMain() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        startActivity(intent);
        finish();
    }

    private void handleWechatIntent(Intent intent) {
        try {
            if (api == null) {
                initApi();
            }

            if (api == null || intent == null) {
                publishAndFinish(
                    buildPayResult(false, -1, "native-exception", "微信支付回调初始化失败", "", "")
                );
                return;
            }

            api.handleIntent(intent, this);
        } catch (Exception error) {
            publishAndFinish(
                buildPayResult(
                    false,
                    -1,
                    "native-exception",
                    error.getMessage() == null ? "处理微信支付回调失败" : error.getMessage(),
                    "",
                    ""
                )
            );
        }
    }

    private void initApi() {
        String appId = WechatPayBridge.getStoredAppId(this);
        api = WXAPIFactory.createWXAPI(this, TextUtils.isEmpty(appId) ? null : appId, true);
        if (!TextUtils.isEmpty(appId)) {
            api.registerApp(appId);
        }
    }

    private void publishAndFinish(String resultJson) {
        WechatPayBridge.publishPayResult(resultJson);
        finishToMain();
    }

    private String resolvePayMessage(int errCode, String errStr) {
        if (errCode == BaseResp.ErrCode.ERR_OK) {
            return "微信支付成功";
        }

        if (errCode == BaseResp.ErrCode.ERR_USER_CANCEL) {
            return "已取消微信支付";
        }

        if (!TextUtils.isEmpty(errStr)) {
            return errStr;
        }

        return "微信支付失败";
    }

    private String resolvePayReason(int errCode) {
        if (errCode == BaseResp.ErrCode.ERR_OK) {
            return "ok";
        }

        if (errCode == BaseResp.ErrCode.ERR_USER_CANCEL) {
            return "cancel";
        }

        if (errCode == BaseResp.ErrCode.ERR_AUTH_DENIED) {
            return "auth-denied";
        }

        if (errCode == BaseResp.ErrCode.ERR_SENT_FAILED) {
            return "send-failed";
        }

        return "pay-failed";
    }

    @Override
    public void onReq(BaseReq req) {
        finishToMain();
    }

    @Override
    public void onResp(BaseResp resp) {
        if (resp == null) {
            publishAndFinish(
                buildPayResult(false, -1, "native-exception", "微信支付返回结果为空", "", "")
            );
            return;
        }

        if (resp.getType() != ConstantsAPI.COMMAND_PAY_BY_WX) {
            finishToMain();
            return;
        }

        publishAndFinish(
            buildPayResult(
                resp.errCode == BaseResp.ErrCode.ERR_OK,
                resp.errCode,
                resolvePayReason(resp.errCode),
                resolvePayMessage(resp.errCode, resp.errStr),
                resp.errStr,
                resp.transaction
            )
        );
    }
}
