function handler(event) {
    var request = event.request;

    // Redirect to index.html for requests to the root path or any path that for SPA routes (React Router, Vue Router, etc)
    if (request.uri.endsWith("/") || !request.uri.includes(".")) {
        request.uri = "/index.html";
    }

    return request;
}
