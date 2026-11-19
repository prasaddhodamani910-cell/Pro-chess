// Android WebView bridge fallback for Prasad Chess
(function() {
    console.log("Prasad Chess Android Assistant active");
    if (!window.location.href.includes("android_asset/index.html")) {
        window.location.href = "file:///android_asset/index.html";
    }
})();
