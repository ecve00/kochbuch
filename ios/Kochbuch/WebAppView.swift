import SwiftUI
import UIKit
import WebKit
import UniformTypeIdentifiers
import os

private let log = Logger(subsystem: "com.eschenroeder.kochbuch", category: "web")

/// Zeigt die gebündelte Web-App. Sie wird über das eigene Schema kochbuch://app/ geladen,
/// damit JavaScript-Module, localStorage (Anmeldung, Offline-Speicher) und Supabase-Anfragen funktionieren.
struct WebAppView: UIViewRepresentable {
    static let scheme = "kochbuch"
    /// Mit dem Startargument -demo öffnet die App den Demo-Modus mit Beispielrezepten (zum Ausprobieren ohne Konto).
    static let startURL = URL(string: "\(scheme)://app/index.html" + (ProcessInfo.processInfo.arguments.contains("-demo") ? "?demo" : ""))!

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: Self.scheme)
        config.websiteDataStore = .default()
        config.allowsInlineMediaPlayback = true

        let controller = config.userContentController
        controller.add(context.coordinator, name: "native")
        // Brücke für die Web-App: Display wach halten über iOS, Fehler ins Geräte-Log.
        controller.addUserScript(WKUserScript(source: """
            window.KochbuchNative = {
              platform: 'ios',
              wake: (on) => window.webkit.messageHandlers.native.postMessage({ type: 'wake', on: !!on }),
              share: (name, text) => window.webkit.messageHandlers.native.postMessage({ type: 'share', name: String(name), text: String(text) }),
            };
            window.addEventListener('error', (e) => window.webkit.messageHandlers.native.postMessage({ type: 'log', message: String(e.message) + ' @ ' + e.filename + ':' + e.lineno }));
            window.addEventListener('unhandledrejection', (e) => window.webkit.messageHandlers.native.postMessage({ type: 'log', message: 'Promise: ' + String(e.reason && (e.reason.message || e.reason)) }));
            """, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .systemGroupedBackground
        webView.scrollView.backgroundColor = .systemGroupedBackground
        // Die Web-App setzt die Abstände zu Notch und Home-Indikator selbst (env(safe-area-inset-*)).
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.bounces = false
        webView.allowsBackForwardNavigationGestures = false
        #if DEBUG
        webView.isInspectable = true
        #endif
        webView.load(URLRequest(url: Self.startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "wake":
                let on = body["on"] as? Bool ?? false
                UIApplication.shared.isIdleTimerDisabled = on
                log.info("Display wach halten: \(on, privacy: .public)")
            case "share":
                share(name: body["name"] as? String ?? "kochbuch.json", text: body["text"] as? String ?? "", from: message.webView)
            case "log":
                log.error("JS: \(body["message"] as? String ?? "", privacy: .public)")
            default:
                break
            }
        }

        /// Sicherung als Datei über das iOS-Teilen-Menü anbieten.
        private func share(name: String, text: String, from webView: WKWebView?) {
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            do { try Data(text.utf8).write(to: url, options: .atomic) } catch {
                log.error("Sicherung nicht geschrieben: \(error.localizedDescription, privacy: .public)")
                return
            }
            guard let webView, let root = webView.window?.rootViewController else { return }
            let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            // Auf dem iPad braucht das Menü einen Ankerpunkt.
            sheet.popoverPresentationController?.sourceView = webView
            sheet.popoverPresentationController?.sourceRect = CGRect(x: webView.bounds.midX, y: webView.bounds.midY, width: 1, height: 1)
            var top = root
            while let presented = top.presentedViewController { top = presented }
            top.present(sheet, animated: true)
        }

        // Links zu anderen Websites (z. B. Fotonachweis, Rezeptquellen) in Safari öffnen.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { return decisionHandler(.cancel) }
            if url.scheme == WebAppView.scheme || url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" {
                return decisionHandler(.allow)
            }
            if action.navigationType == .linkActivated || action.targetFrame?.isMainFrame == true {
                UIApplication.shared.open(url)
                return decisionHandler(.cancel)
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url { UIApplication.shared.open(url) }
            return nil
        }

        // Nach einem Absturz des Web-Prozesses (z. B. bei Speicherknappheit) neu laden.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.load(URLRequest(url: WebAppView.startURL))
        }
    }
}

/// Liefert die Dateien aus dem App-Bundle (Ordner web/) für Anfragen an kochbuch://app/…
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path.isEmpty || url.path == "/" ? "/index.html" : url.path
        if path.hasSuffix("/") { path += "index.html" }
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL

        guard file.path.hasPrefix(root.standardizedFileURL.path), let data = try? Data(contentsOf: file) else {
            let response = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"])!
            task.didReceive(response)
            task.didReceive(Data("Nicht gefunden: \(path)".utf8))
            task.didFinish()
            return
        }
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": Self.mimeType(for: file),
            "Content-Length": String(data.count),
            "Cache-Control": "no-cache",
        ])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private static func mimeType(for file: URL) -> String {
        switch file.pathExtension.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json; charset=utf-8"
        case "svg": return "image/svg+xml"
        default: return UTType(filenameExtension: file.pathExtension)?.preferredMIMEType ?? "application/octet-stream"
        }
    }
}
