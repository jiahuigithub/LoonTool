/*
 * ============================================================
 * 动卡空间开屏广告拦截
 * Loon Response Script
 * ============================================================
 *
 * 当前已验证广告素材：
 * 750 × 1330
 *
 * 广告图片 CDN：
 * ump.szcdn.creditcard.ecitic.com/ump/img/
 *
 * 注意：
 * 750 × 1330 是“开屏广告图片素材”的像素尺寸，
 * 并不一定等于手机本身的屏幕分辨率。
 *
 * 支持图片格式：
 * JPEG / PNG / WebP / GIF
 *
 * ------------------------------------------------------------
 * 【其他手机 / 其他版本如果不生效】
 *
 * 如果 Loon 已经有“动卡空间开屏广告”的脚本运行记录，
 * 但是广告依然存在，并且日志显示：
 *
 * [DKKJ-AD] JPEG xxxx×xxxx ...
 * [DKKJ-AD] 普通图片 -> 放行
 *
 * 说明新版广告图片尺寸已经超出当前判断范围。
 *
 * 这种情况不需要修改下面的大段代码，
 * 只需要修改下面“广告尺寸判断参数”中的 6 个数字。
 *
 * 如果完全没有脚本运行记录，
 * 先检查 MitM 是否已经加入：
 *
 * ump.szcdn.creditcard.ecitic.com
 *
 * ============================================================
 */


/* ============================================================
 * 【广告尺寸判断参数】
 *
 * ★★★★★ 其他机型 / 新版广告不命中时，只改这里 ★★★★★
 *
 * 当前实际抓包确认：
 *
 * 宽：750
 * 高：1330
 *
 * 高宽比：
 * 1330 ÷ 750 ≈ 1.773
 *
 * 为避免广告图片尺寸稍有变化就失效，
 * 当前没有写死为 750×1330，
 * 而是使用一个尺寸范围进行判断。
 *
 * 例如：
 * 如果日志显示新版广告是 828×1470，
 * 就把 MAX_AD_WIDTH、MAX_AD_HEIGHT 适当调大。
 *
 * ============================================================
 */

const MIN_AD_WIDTH  = 700;
// 广告图片最小宽度
// 当前广告宽度 750

const MAX_AD_WIDTH  = 800;
// 广告图片最大宽度
// 如果以后变成 828 等尺寸，可适当调大


const MIN_AD_HEIGHT = 1250;
// 广告图片最小高度
// 当前广告高度 1330

const MAX_AD_HEIGHT = 1400;
// 广告图片最大高度
// 如果以后变成 1470 等尺寸，可适当调大


const MIN_AD_RATIO  = 1.65;
// 最小 高度÷宽度 比例

const MAX_AD_RATIO  = 1.90;
// 最大 高度÷宽度 比例


/* ============================================================
 * 以下为图片解析代码
 * 一般不需要修改
 * ============================================================
 */


function getBytes() {

    let body = null;

    if (
        typeof $response.bodyBytes !== "undefined" &&
        $response.bodyBytes
    ) {
        body = $response.bodyBytes;

    } else if (
        typeof $response.body !== "undefined"
    ) {
        body = $response.body;
    }

    if (!body) {
        return null;
    }

    if (body instanceof Uint8Array) {
        return body;
    }

    if (body instanceof ArrayBuffer) {
        return new Uint8Array(body);
    }

    if (ArrayBuffer.isView(body)) {
        return new Uint8Array(
            body.buffer,
            body.byteOffset,
            body.byteLength
        );
    }

    if (Array.isArray(body)) {
        return new Uint8Array(body);
    }

    return null;
}


/* ============================
 * JPEG 尺寸识别
 * ============================
 */

function getJpegSize(b) {

    if (
        !b ||
        b.length < 10 ||
        b[0] !== 0xFF ||
        b[1] !== 0xD8
    ) {
        return null;
    }

    let i = 2;

    while (i + 9 < b.length) {

        if (b[i] !== 0xFF) {
            i++;
            continue;
        }

        const marker = b[i + 1];

        i += 2;

        if (
            marker === 0xD8 ||
            marker === 0xD9 ||
            marker === 0x01 ||
            (
                marker >= 0xD0 &&
                marker <= 0xD7
            )
        ) {
            continue;
        }

        if (i + 1 >= b.length) {
            break;
        }

        const len =
            (b[i] << 8) |
            b[i + 1];

        if (
            len < 2 ||
            i + len > b.length
        ) {
            break;
        }

        if (
            marker === 0xC0 ||
            marker === 0xC1 ||
            marker === 0xC2 ||
            marker === 0xC3 ||
            marker === 0xC5 ||
            marker === 0xC6 ||
            marker === 0xC7 ||
            marker === 0xC9 ||
            marker === 0xCA ||
            marker === 0xCB ||
            marker === 0xCD ||
            marker === 0xCE ||
            marker === 0xCF
        ) {

            return {
                format: "JPEG",

                width:
                    (b[i + 5] << 8) |
                    b[i + 6],

                height:
                    (b[i + 3] << 8) |
                    b[i + 4]
            };
        }

        i += len;
    }

    return null;
}


/* ============================
 * PNG 尺寸识别
 * ============================
 */

function getPngSize(b) {

    if (
        !b ||
        b.length < 24
    ) {
        return null;
    }

    if (
        b[0] !== 0x89 ||
        b[1] !== 0x50 ||
        b[2] !== 0x4E ||
        b[3] !== 0x47 ||
        b[4] !== 0x0D ||
        b[5] !== 0x0A ||
        b[6] !== 0x1A ||
        b[7] !== 0x0A
    ) {
        return null;
    }

    const width =
        (
            b[16] * 0x1000000 +
            b[17] * 0x10000 +
            b[18] * 0x100 +
            b[19]
        ) >>> 0;

    const height =
        (
            b[20] * 0x1000000 +
            b[21] * 0x10000 +
            b[22] * 0x100 +
            b[23]
        ) >>> 0;

    return {
        format: "PNG",
        width: width,
        height: height
    };
}


/* ============================
 * GIF 尺寸识别
 * ============================
 */

function getGifSize(b) {

    if (
        !b ||
        b.length < 10
    ) {
        return null;
    }

    const isGif =
        b[0] === 0x47 &&
        b[1] === 0x49 &&
        b[2] === 0x46 &&
        b[3] === 0x38 &&
        (
            b[4] === 0x37 ||
            b[4] === 0x39
        ) &&
        b[5] === 0x61;

    if (!isGif) {
        return null;
    }

    return {
        format: "GIF",

        width:
            b[6] |
            (b[7] << 8),

        height:
            b[8] |
            (b[9] << 8)
    };
}


/* ============================
 * WebP 尺寸识别
 * ============================
 */

function getWebpSize(b) {

    if (
        !b ||
        b.length < 30
    ) {
        return null;
    }

    if (
        b[0] !== 0x52 ||
        b[1] !== 0x49 ||
        b[2] !== 0x46 ||
        b[3] !== 0x46 ||
        b[8] !== 0x57 ||
        b[9] !== 0x45 ||
        b[10] !== 0x42 ||
        b[11] !== 0x50
    ) {
        return null;
    }

    const type = String.fromCharCode(
        b[12],
        b[13],
        b[14],
        b[15]
    );


    // VP8X
    if (
        type === "VP8X" &&
        b.length >= 30
    ) {

        return {
            format: "WebP",

            width:
                1 +
                b[24] +
                (b[25] << 8) +
                (b[26] << 16),

            height:
                1 +
                b[27] +
                (b[28] << 8) +
                (b[29] << 16)
        };
    }


    // VP8L
    if (
        type === "VP8L" &&
        b.length >= 25 &&
        b[20] === 0x2F
    ) {

        const bits =
            (
                b[21] |
                (b[22] << 8) |
                (b[23] << 16) |
                (b[24] << 24)
            ) >>> 0;

        return {
            format: "WebP",

            width:
                (bits & 0x3FFF) + 1,

            height:
                ((bits >>> 14) & 0x3FFF) + 1
        };
    }


    // VP8
    if (
        type === "VP8 " &&
        b.length >= 30 &&
        b[23] === 0x9D &&
        b[24] === 0x01 &&
        b[25] === 0x2A
    ) {

        return {
            format: "WebP",

            width:
                (
                    b[26] |
                    (b[27] << 8)
                ) & 0x3FFF,

            height:
                (
                    b[28] |
                    (b[29] << 8)
                ) & 0x3FFF
        };
    }

    return null;
}


/* ============================
 * 统一识别图片类型
 * ============================
 */

function getImageSize(b) {

    return (
        getJpegSize(b) ||
        getPngSize(b) ||
        getWebpSize(b) ||
        getGifSize(b)
    );
}


/* ============================================================
 * 开始处理响应体
 * ============================================================
 */

const bytes = getBytes();


if (!bytes) {

    console.log(
        "[DKKJ-AD] 未取得二进制响应体 -> 放行"
    );

    $done({});

} else {

    const img = getImageSize(bytes);


    if (!img) {

        console.log(
            "[DKKJ-AD] 未识别图片格式 -> 放行"
        );

        $done({});

    } else {

        const ratio =
            img.width > 0
                ? img.height / img.width
                : 0;


        console.log(
            "[DKKJ-AD] " +
            img.format +
            " " +
            img.width +
            "x" +
            img.height +
            " ratio=" +
            ratio.toFixed(3) +
            " / " +
            bytes.length +
            " bytes"
        );


        /*
         * ====================================================
         * 当前确认广告：
         *
         * 750 × 1330
         *
         * 不写死具体尺寸，
         * 使用顶部设置的尺寸范围进行判断。
         * ====================================================
         */

        const isAd =
            img.width >= MIN_AD_WIDTH &&
            img.width <= MAX_AD_WIDTH &&

            img.height >= MIN_AD_HEIGHT &&
            img.height <= MAX_AD_HEIGHT &&

            ratio >= MIN_AD_RATIO &&
            ratio <= MAX_AD_RATIO;


        if (isAd) {

            console.log(
                "[DKKJ-AD] 命中动卡空间开屏广告 -> 204"
            );

            $done({
                status: 204,
                headers: {},
                body: ""
            });

        } else {

            console.log(
                "[DKKJ-AD] 普通图片 -> 放行"
            );

            $done({});
        }
    }
}