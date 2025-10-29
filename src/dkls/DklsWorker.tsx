import React, {useRef, useEffect, useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';

type Pending = {
  resolve: (v: any) => void;
  reject: (e: any) => void;
};

let _post: ((data: any) => void) | null = null;
let _isReady = false;
let _readyResolve: (() => void) | null = null;
const _readyPromise: Promise<void> = new Promise(res => (_readyResolve = res));
const _outQueue: string[] = [];
const pendings = new Map<number, Pending>();
let seq = 1;

export async function callWorker<T = any>(msg: any): Promise<T> {
  const id = ++seq;
  const payload = JSON.stringify({id, ...msg});

  if (!_isReady) {
    await _readyPromise;
  }

  return new Promise<T>((resolve, reject) => {
    pendings.set(id, {resolve, reject});
    if (_post) _post(payload);
    else _outQueue.push(payload);
  });
}

export const DklsWorkerHost = () => {
  const [bootHtml] = useState(() => {
    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="
        default-src 'none';
        script-src 'self' https://unpkg.com/@silencelaboratories/dkls-wasm-ll-web@latest/ 'unsafe-inline' 'unsafe-eval';
        connect-src https://unpkg.com/@silencelaboratories/dkls-wasm-ll-web@latest/;
        worker-src 'self' blob:;
      "
    />
  </head>
  <body>
    <script>
      (() => {
        // ---- Safe postMessage with queue -----------------
        const queue = [];

        function canPost() {
          return !!(window.ReactNativeWebView && window.ReactNativeWebView.postMessage);
        }

        function rawPost(obj) {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify(obj));
          } catch (e) {}
        }

        function post(obj) {
          if (canPost()) rawPost(obj);
          else queue.push(obj);
        }

        function flush() {
          while (queue.length && canPost()) rawPost(queue.shift());
        }

        window.onerror = function (msg, src, line, col, err) {
          post({
            id: -3,
            ok: false,
            result: "[ONERROR] " + msg + " @ " + src + ":" + line + ":" + col + " :: " + (err && err.stack || err)
          });
        };

        window.onunhandledrejection = function (ev) {
          var r = String(ev.reason && ev.reason.stack || ev.reason);
          post({ id: -4, ok: false, result: "[UNHANDLED] " + r });
        };

        post({ id: -2, ok: true, result: "HELLO_FROM_WEBVIEW" });

        var iv = setInterval(function () {
          if (canPost()) {
            clearInterval(iv);
            flush();
            post({ id: -1, ok: true, result: "BOOTED" });
          }
        }, 50);

        setTimeout(function () {
          clearInterval(iv);
          if (canPost()) {
            flush();
            post({ id: -1, ok: true, result: "BOOTED_LATE" });
          }
        }, 8000);

        // ---- RPC host ------------------------------------------------------
        function reply(id, ok, result) {
          post({ id, ok, result });
        }

        const objects = new Map();
        let nextId = 1;
        let dklsMod = null;

        async function ensureDkls() {
          if (dklsMod) return dklsMod;
          try {
            const JS_URL =
              "https://unpkg.com/@silencelaboratories/dkls-wasm-ll-web@latest/dkls-wasm-ll-web.js";
            const WASM_URL =
              "https://unpkg.com/@silencelaboratories/dkls-wasm-ll-web@latest/dkls-wasm-ll-web_bg.wasm";

            if (
              !JS_URL.startsWith("https://unpkg.com/@silencelaboratories/dkls-wasm-ll-web@latest/") ||
              !WASM_URL.startsWith("https://unpkg.com/@silencelaboratories/dkls-wasm-ll-web@latest/")
            ) {
              throw new Error("Blocked non-allowlisted URL");
            }

            const mod = await import(JS_URL);
            await mod.default(WASM_URL);
            dklsMod = mod;
            return dklsMod;
          } catch (e) {
            throw e;
          }
        }

        function toU8(x) {
          if (x == null) return undefined;
          if (x instanceof Uint8Array) return x;
          if (Array.isArray(x)) return new Uint8Array(x);
          if (typeof x === "object") return new Uint8Array(Object.values(x));
          throw new Error("Bad seed");
        }

        function deproxy(v) {
          if (Array.isArray(v)) return v.map(deproxy);
          if (v && typeof v === "object") {
            if (typeof v._id === "number") {
              var o = objects.get(v._id);
              if (!o) throw new Error("Unknown objId " + v._id);
              return o;
            }
            var r = {};
            for (var k in v) r[k] = deproxy(v[k]);
            return r;
          }
          return v;
        }

        function clone(v) {
          if (v instanceof Uint8Array) return new Uint8Array(v);
          if (Array.isArray(v)) return v.map(clone);
          if (v && typeof v === "object") {
            var o = {};
            for (var k in v) o[k] = clone(v[k]);
            return o;
          }
          return v;
        }

        function norm(x) {
          if (x instanceof Uint8Array) return Array.from(x);
          if (x instanceof ArrayBuffer) return Array.from(new Uint8Array(x));
          if (dklsMod && x instanceof dklsMod.Message) {
            return {
              payload: Array.from(x.payload),
              from_id: x.from_id,
              to_id: x.to_id,
            };
          }
          if (Array.isArray(x)) return x.map(norm);
          return x;
        }

        async function onCall(data) {
          post({
            id: -998,
            ok: true,
            result: "[DKLS LOG] onCall with args=" + JSON.stringify(data)
          });

          const { id, type } = data;
          try {
            if (type === "init") {
              await ensureDkls();
              return reply(id, true, "ok");
            }

            const mod = await ensureDkls();

            if (type === "construct") {
              const { className, args } = data;
              const Ctor = mod[className];
              if (typeof Ctor !== "function") {
                throw new Error("No class: " + className);
              }
              let a = clone(deproxy(args || []), mod);
              if (!Array.isArray(a)) a = [a];
              if (className === "KeygenSession" && a.length >= 4) {
                a[3] = toU8(a[3]);
              }
              if (className === "Message" && a.length >= 1) {
                a[0] = toU8(a[0]);
              }
              const inst = new Ctor(...a);
              const objId = nextId++;
              objects.set(objId, inst);
              return reply(id, true, { objId });
            }

            if (type === "staticConstruct") {
              var S = mod[data.className];
              var fn = S && S[data.method];
              if (typeof fn !== "function") throw new Error("No static " + data.className + "." + data.method);
              var a2 = clone(deproxy(data.args || []));
              var inst2 = fn(...a2);
              var oid2 = nextId++;
              objects.set(oid2, inst2);
              return post({ id: id, ok: true, result: { objId: oid2 } });
            }

            if (type === 'call') {
              const { objId, method, args } = data;
              const obj = objects.get(objId);
              if (!obj) throw new Error('Unknown objId ' + objId);
              const fn = obj[method];
              if (typeof fn !== 'function') throw new Error('No method ' + method);
              const a = Array.isArray(args) ? args : (args == null ? [] : [args]);
              let res = fn.apply(obj, a);
              if (res && typeof res.then === 'function') res = await res;
              return reply(id, true, norm(res));
            }

            if (type === "get") {
              const { objId, prop } = data;
              const obj = objects.get(objId);
              if (!obj) throw new Error("Unknown objId " + objId);
              const val = await obj[prop];
              return reply(id, true, val);
            }

            if (type === "free") {
              const { objId } = data;
              objects.delete(objId);
              return reply(id, true, "freed");
            }

            throw new Error("Unknown type " + type);
          } catch (e) {
            reply(id, false, String((e && e.message) || e));
          }
        }

        window.addEventListener('message', (ev) => {
          const data = JSON.parse(ev.data);
          onCall(data);
        });
      })();
    </script>
  </body>
</html>
    `;
  });

  const ref = useRef<WebView>(null);

  const onMessage = (ev: WebViewMessageEvent) => {
    try {
      const {id, ok, result} = JSON.parse(ev.nativeEvent.data);

      if (typeof id === 'number' && id < -2) {
        console.log('[DKLS LOG] internal log', result);
        return;
      }

      if (
        id === -1 &&
        ok &&
        (result === 'BOOTED' || result === 'BOOTED_LATE')
      ) {
        if (!_isReady) {
          _isReady = true;
          _readyResolve?.();
          _readyResolve = null;
          if (_outQueue.length && _post) {
            for (const p of _outQueue.splice(0)) _post(p);
          }
        }
        return;
      }

      const p = pendings.get(id);
      if (!p) return;
      pendings.delete(id);
      if (ok) p.resolve(result);
      else p.reject(result);
    } catch (e) {
      console.log('[DKLS HOST] onMessage parse error', e);
    }
  };

  useEffect(() => {
    _post = data => {
      ref.current?.postMessage(data);
    };
    // if anything was queued before _post existed
    if (_outQueue.length && _post) {
      for (const p of _outQueue.splice(0)) _post(p);
    }
    return () => {
      _post = null;
    };
  }, []);

  return (
    <View style={styles.hidden}>
      <WebView
        ref={ref}
        source={{html: bootHtml}}
        originWhitelist={['about:blank']}
        onShouldStartLoadWithRequest={req => req.url === 'about:blank'}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        onMessage={onMessage}
        domStorageEnabled={false}
        allowFileAccess={false}
        thirdPartyCookiesEnabled={false}
        sharedCookiesEnabled={false}
        incognito
        mixedContentMode="never"
        onLoad={() => console.log('[DKLS HOST] webview onLoad')}
        onError={e => console.log('[DKLS HOST] onError', e?.nativeEvent)}
        onHttpError={e =>
          console.log('[DKLS HOST] onHttpError', e?.nativeEvent)
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hidden: {width: 0, height: 0, overflow: 'hidden'},
});
