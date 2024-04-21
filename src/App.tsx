import "./App.css";

function App() {
    return (
        <>
            <h1>Image processor demo blog</h1>
            <p>View resized images</p>
            <figure>
                <figcaption>Full HD</figcaption>
                <img src="https://blog.demo.jharris.nz/assets/images/1.jpeg?width=1920&height=1280&fit=cover" alt="Resized image" />
            </figure>
            <figure>
                <figcaption>Full HD</figcaption>
                <img src="https://blog.demo.jharris.nz/assets/images/1.jpeg?width=1920&height=1280&fit=cover&format=jpeg" alt="Resized image" />
            </figure>
            <figure>
                <figcaption>Original image</figcaption>
                <img src="https://blog.demo.jharris.nz/assets/images/1.jpeg?width=200&height=100&fit=cover" alt="Resized image" />
            </figure>
        </>
    );
}

export default App;
