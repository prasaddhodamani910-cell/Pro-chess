package com.chessvision.app

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

class AndroidBridge(
    private val context: Context,
    private val webView: WebView,
    private val engine: ChessEngine
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.Default)

    @JavascriptInterface
    fun getStatus(): String {
        val json = JSONObject()
        json.put("engine_name", "Chessmod Engine by PRASAD DHODAMANI")
        json.put("engine_available", true)
        json.put("version", "1.0.0")
        return json.toString()
    }

    @JavascriptInterface
    fun analyzeFen(fen: String, turn: String, thinkMs: Long): String {
        return try {
            val t = if (turn.isNotEmpty()) turn[0] else 'w'
            val ms = if (thinkMs in 200..5000) thinkMs else 1000L
            val res = engine.analyze(fen, t, ms)

            val json = JSONObject()
            json.put("ok", res.ok)
            json.put("best_move", res.bestMove)
            json.put("score", res.score)
            json.put("score_val", res.scoreVal)
            json.put("depth", res.depth)
            json.put("nodes", res.nodes)
            json.put("fen", res.fen)
            val pvArray = JSONArray()
            res.pv.forEach { pvArray.put(it) }
            json.put("pv", pvArray)

            // Also deliver asynchronously to webview callback if registered
            mainHandler.post {
                val escapedJson = json.toString().replace("'", "\\'")
                webView.evaluateJavascript("if (window.onEngineResult) window.onEngineResult('$escapedJson');", null)
            }

            json.toString()
        } catch (e: Exception) {
            val err = JSONObject()
            err.put("ok", false)
            err.put("error", e.message ?: "Unknown error")
            err.toString()
        }
    }

    @JavascriptInterface
    fun analyzeFenAsync(fen: String, turn: String, thinkMs: Long, callbackId: String) {
        scope.launch {
            try {
                val t = if (turn.isNotEmpty()) turn[0] else 'w'
                val ms = if (thinkMs in 200..5000) thinkMs else 1000L
                val res = engine.analyze(fen, t, ms)

                val json = JSONObject()
                json.put("ok", res.ok)
                json.put("best_move", res.bestMove)
                json.put("score", res.score)
                json.put("score_val", res.scoreVal)
                json.put("depth", res.depth)
                json.put("nodes", res.nodes)
                json.put("fen", res.fen)
                json.put("callbackId", callbackId)

                mainHandler.post {
                    val escaped = json.toString().replace("'", "\\'")
                    webView.evaluateJavascript("if (window.onAsyncAnalysis) window.onAsyncAnalysis('$escaped');", null)
                }
            } catch (e: Exception) {
                mainHandler.post {
                    val err = JSONObject()
                    err.put("ok", false)
                    err.put("error", e.message ?: "Analysis failed")
                    err.put("callbackId", callbackId)
                    webView.evaluateJavascript("if (window.onAsyncAnalysis) window.onAsyncAnalysis('${err.toString().replace("'", "\\'")}');", null)
                }
            }
        }
    }

    @JavascriptInterface
    fun navigate(url: String) {
        mainHandler.post {
            var target = url.trim()
            if (!target.startsWith("http://") && !target.startsWith("https://")) {
                target = "https://$target"
            }
            webView.loadUrl(target)
        }
    }

    @JavascriptInterface
    fun showToast(msg: String) {
        mainHandler.post {
            Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
        }
    }
}
