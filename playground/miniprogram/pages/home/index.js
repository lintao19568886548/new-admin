/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires, unicorn/prefer-module, unicorn/prefer-string-raw, unicorn/prefer-string-replace-all */

const config = require('../../config');

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function decode(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
}

function getQueryValueFromUrl(url, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(url || '').match(
    new RegExp(`[?&]${escapedKey}=([^&]+)`),
  );
  return match?.[1] ? decode(match[1]) : '';
}

function getSceneFromOptions(options) {
  const directScene = decode(options.scene || options.s || '');
  if (directScene) {
    return directScene;
  }

  const q = decode(options.q || '');
  if (!q) {
    return '';
  }
  return getQueryValueFromUrl(q, 'scene') || getQueryValueFromUrl(q, 's');
}

Page({
  data: {
    // 下载链接
    androidUrl: '',
    channelName: '',
    errorMessage: '',
    iosUrl: '',
    isFirstBind: false,
    openid: '',
    // 绑定结果
    ownerName: '',
    phone: '',
    scene: '',
    // 阶段：'loading' | 'auth' | 'bound' | 'error'
    stage: 'loading',
    unionid: '',
  },

  fetchDownloadUrl() {
    const apiBaseUrl = trimSlash(config.API_BASE_URL);
    wx.request({
      fail: () => {},
      header: { 'Content-Type': 'application/json' },
      method: 'GET',
      success: (response) => {
        const body = response.data || {};
        if (body.code === 0 && body.data) {
          this.setData({
            androidUrl: body.data.androidUrl || '',
            iosUrl: body.data.iosUrl || '',
          });
        }
      },
      url: `${apiBaseUrl}/system/version`,
    });
  },

  onGetPhoneNumber(event) {
    const code = event.detail && event.detail.code;
    if (!code) {
      wx.showToast({ icon: 'none', title: '未获取到手机号授权' });
      return;
    }

    this.setData({ stage: 'loading' });
    this.request('/crm/miniprogram/phone', { code })
      .then((result) => {
        const phone = result.phoneNumber || '';
        this.setData({ phone });
        return this.resolveBinding(phone);
      })
      .catch((error) => {
        wx.showToast({
          icon: 'none',
          title: error.message || '获取手机号失败',
        });
        this.setData({ stage: 'auth' });
      });
  },

  onLoad(options) {
    const scene = getSceneFromOptions(options || {});
    this.setData({ scene });

    if (!scene) {
      this.setData({
        errorMessage: '二维码参数缺失，请重新扫码',
        stage: 'error',
      });
      return;
    }

    // 先用 wx.login 换 openid/unionid，失败了也不阻塞，直接展示授权按钮
    wx.login({
      fail: () => {
        this.setData({ stage: 'auth' });
      },
      success: ({ code }) => {
        if (!code) {
          this.setData({ stage: 'auth' });
          return;
        }
        this.request('/crm/miniprogram/session', { code })
          .then((session) => {
            this.setData({
              openid: session.openid || '',
              stage: 'auth',
              unionid: session.unionid || '',
            });
          })
          .catch(() => {
            this.setData({ stage: 'auth' });
          });
      },
    });
  },

  openDownload() {
    const { androidUrl, iosUrl } = this.data;
    const systemInfo = wx.getSystemInfoSync();
    const isIos = systemInfo.platform === 'ios';
    const url = isIos ? iosUrl : androidUrl;

    if (!url) {
      wx.showModal({
        content: '请在手机应用市场搜索「瞰维智管」下载',
        showCancel: false,
        title: '下载 App',
      });
      return;
    }

    wx.setClipboardData({
      data: url,
      success: () => {
        wx.showToast({
          icon: 'success',
          title: isIos ? 'App Store 链接已复制' : '下载链接已复制',
        });
      },
    });
  },

  request(path, data) {
    const apiBaseUrl = trimSlash(config.API_BASE_URL);
    return new Promise((resolve, reject) => {
      wx.request({
        data,
        fail: () => reject(new Error('接口请求失败')),
        header: { 'Content-Type': 'application/json' },
        method: 'POST',
        success: (response) => {
          const body = response.data || {};
          if (body.code === 0) {
            resolve(body.data || {});
            return;
          }
          reject(new Error(body.message || '接口请求失败'));
        },
        url: `${apiBaseUrl}${path}`,
      });
    });
  },

  resolveBinding(phone) {
    return this.request('/crm/invite/resolve', {
      openid: this.data.openid,
      phone,
      scene: this.data.scene,
      source: 'miniprogram',
      unionid: this.data.unionid,
    })
      .then((result) => {
        const ownerName =
          (result.owner && (result.owner.salesName || result.owner.realName)) ||
          '专属顾问';
        const channelName =
          (result.channel && result.channel.channelName) || '';
        const isFirstBind = !!result.isFirstBind;
        this.setData({
          channelName,
          isFirstBind,
          ownerName,
          stage: 'bound',
        });
        this.fetchDownloadUrl();
      })
      .catch((error) => {
        this.setData({
          errorMessage: error.message || '绑定失败，请重新扫码',
          stage: 'error',
        });
      });
  },
});
