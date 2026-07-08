package cn.yizuw.magic.backend.crm;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.Map;
import javax.imageio.ImageIO;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

/** CRM H5 邀请二维码生成器；本地生成 PNG data URL，不调用微信或企微接口。 */
final class SimpleQrCodeGenerator {

  private SimpleQrCodeGenerator() {}

  static String toPngDataUrl(String content, int requestedWidth) {
    int width = Math.min(1280, Math.max(180, requestedWidth <= 0 ? 430 : requestedWidth));
    try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      BitMatrix matrix =
          new QRCodeWriter()
              .encode(
                  content,
                  BarcodeFormat.QR_CODE,
                  width,
                  width,
                  Map.of(
                      EncodeHintType.CHARACTER_SET,
                      "UTF-8",
                      EncodeHintType.ERROR_CORRECTION,
                      ErrorCorrectionLevel.M,
                      EncodeHintType.MARGIN,
                      2));
      ImageIO.write(MatrixToImageWriter.toBufferedImage(matrix), "png", output);
      return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
    } catch (WriterException error) {
      throw new IllegalArgumentException("二维码内容无效", error);
    } catch (Exception error) {
      throw new IllegalStateException("生成 H5 邀请二维码失败", error);
    }
  }
}
