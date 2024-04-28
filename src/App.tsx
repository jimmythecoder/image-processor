import "./App.css";

function App() {
    return (
        <>
            <h1>Image processor demo blog</h1>
            <p>View resized images</p>
            <figure>
                <figcaption>Full HD</figcaption>
                <img src="https://blog.demo.jharris.nz/uploads/resize/1.jpeg?width=1920&height=1280&fit=cover&format=avif" alt="AVIF image" />
            </figure>
            <figure>
                <figcaption>Full HD</figcaption>
                <img src="https://blog.demo.jharris.nz/uploads/resize/1.jpeg?width=1920&height=1280&fit=cover&format=jpeg" alt="JPEG HD image" />
            </figure>
            <figure>
                <figcaption>Original image</figcaption>
                <img src="https://blog.demo.jharris.nz/uploads/resize/1.jpeg?width=200&height=100&fit=cover" alt="Original image" />
            </figure>

            <figure>
                <figcaption>Streaming</figcaption>
                <img src="https://blog.demo.jharris.nz/uploads/stream/1.jpeg?width=1920&height=1280&fit=cover&format=avif" alt="Streamed image" />
            </figure>
        </>
    );
}

export default App;
