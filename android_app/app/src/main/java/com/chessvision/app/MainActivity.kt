package com.chessvision.app

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import java.io.BufferedReader
import java.io.InputStreamReader

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private val chessEngine = ChessEngine()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)

        setupWebView()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        // Initial chess site
        webView.loadUrl("https://www.chess.com/play/computer")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val s = webView.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.databaseEnabled = true
        s.useWideViewPort = true
        s.loadWithOverviewMode = true
        s.setSupportZoom(true)
        s.builtInZoomControls = true
        s.displayZoomControls = false
        s.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        s.cacheMode = WebSettings.LOAD_DEFAULT

        // Standard modern mobile Chrome user agent
        val defaultUa = s.userAgentString
        s.userAgentString = defaultUa.replace("; wv", "")

        val bridge = AndroidBridge(this, webView, chessEngine)
        webView.addJavascriptInterface(bridge, "AndroidBridge")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                if (newProgress < 100) {
                    progressBar.visibility = View.VISIBLE
                    progressBar.progress = newProgress
                } else {
                    progressBar.visibility = View.GONE
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectAssistantAssets()
            }
        }
    }

    private fun injectAssistantAssets() {
        try {
            val css = readAssetFile("assistant.css")
            val js = readAssetFile("assistant.js")

            // Inject CSS safely using style element
            val escapedCss = css.replace("`", "\\`").replace("\\", "\\\\")
            val cssScript = """
                (function() {
                    if (document.getElementById('cv-mobile-style')) return;
                    var style = document.createElement('style');
                    style.id = 'cv-mobile-style';
                    style.textContent = `$escapedCss`;
                    (document.head || document.documentElement).appendChild(style);
                })();
            """.trimIndent()
            webView.evaluateJavascript(cssScript, null)

            // Inject Assistant JS
            webView.evaluateJavascript(js, null)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun readAssetFile(filename: String): String {
        val sb = StringBuilder()
        assets.open(filename).use { stream ->
            BufferedReader(InputStreamReader(stream)).use { reader ->
                var line = reader.readLine()
                while (line != null) {
                    sb.append(line).append("\n")
                    line = reader.readLine()
                }
            }
        }
        return sb.toString()
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
