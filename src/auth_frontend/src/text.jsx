import React, { useState, useEffect } from "react";
import { Actor } from "@dfinity/agent";
import { AuthClient } from "@dfinity/auth-client";
import { auth_backend } from "declarations/auth_backend";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const [authClient, setAuthClient] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [principalId, setPrincipalId] = useState("");
  const [greeting, setGreeting] = useState("");
  const [name, setName] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageData, setImageData] = useState(null);
  const [allImages, setAllImages] = useState([]);
  const [uploadedImageId, setUploadedImageId] = useState(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  async function initializeAuth() {
    try {
      const client = await AuthClient.create();
      setAuthClient(client);

      const isAuthenticated = await client.isAuthenticated();
      if (isAuthenticated) {
        handleSuccess(client);
        toast.success("Authentication restored");
      }
    } catch (error) {
      toast.error("Failed to initialize auth client");
    }
  }

  function handleSuccess(client) {
    const identity = client.getIdentity();
    setIdentity(identity);
    const principal = identity.getPrincipal().toString();
    setPrincipalId(principal);

    Actor.agentOf(auth_backend).replaceIdentity(identity);
    toast.success("Login successful");
    fetchImages();
  }

  async function handleLogin() {
    if (!authClient) {
      toast.error("AuthClient not initialized");
      return;
    }

    const APP_NAME = "NFID example";
    const APP_LOGO = "https://nfid.one/icons/favicon-96x96.png";
    const CONFIG_QUERY = `?applicationName=${APP_NAME}&applicationLogo=${APP_LOGO}`;
    const identityProvider = `https://nfid.one/authenticate${CONFIG_QUERY}`;

    toast.info("Initiating login process");
    authClient.login({
      identityProvider,
      onSuccess: () => handleSuccess(authClient),
      onError: () => toast.error("Login failed"),
      windowOpenerFeatures: `
        left=${window.screen.width / 2 - 525 / 2},
        top=${window.screen.height / 2 - 705 / 2},
        toolbar=0,location=0,menubar=0,width=525,height=705
      `,
    });
  }

  async function handleLogout() {
    if (authClient) {
      await authClient.logout();
      setIdentity(null);
      setPrincipalId("");
      toast.info("Logged out successfully");
    }
  }

  function handleGreetSubmit(event) {
    event.preventDefault();
    toast.info("Sending greet request");
    auth_backend
      .greet(name)
      .then((greeting) => {
        setGreeting(greeting);
        toast.success("Greeting received");
      })
      .catch(() => toast.error("Failed to get greeting"));
  }

  function handleSetNameSubmit(event) {
    event.preventDefault();
    toast.info("Setting name");
    auth_backend
      .set_name(name)
      .then(() => {
        toast.success("Name set successfully!");
      })
      .catch(() => toast.error("Failed to set name"));
  }

  function handleUploadImage(event) {
    event.preventDefault();
    if (imageData && imageName) {
      toast.info("Uploading image");
      auth_backend
        .upload_image(imageName, Array.from(imageData))
        .then((id) => {
          setUploadedImageId(id);
          toast.success(`Image uploaded successfully with ID: ${id}`);
          fetchImages();
        })
        .catch(() => toast.error("Failed to upload image"));
    } else {
      toast.warn("Please select an image to upload.");
    }
  }

  function handleDeleteImage(id) {
    toast.info("Deleting image");
    auth_backend
      .delete_image(id)
      .then((result) => {
        if (result.Success) {
          toast.success("Image deleted successfully!");
          fetchImages();
        } else if (result.NotAuthorized) {
          toast.error("You are not authorized to delete this image.");
        } else {
          toast.error("Failed to delete image. Image not found.");
        }
      })
      .catch(() => toast.error("Error occurred while deleting image"));
  }

  function fetchImages() {
    toast.info("Fetching images");
    auth_backend
      .get_all_images()
      .then((images) => {
        const imageList = images.map(([id, name, creator, data]) => {
          const base64Data = btoa(String.fromCharCode(...new Uint8Array(data)));
          const imageSrc = `data:image/jpeg;base64,${base64Data}`;
          return { id, name, creator, src: imageSrc };
        });
        setAllImages(imageList);
        toast.success("Images fetched successfully");
      })
      .catch(() => toast.error("Failed to fetch images"));
  }

  return (
    <main>
      <ToastContainer position="top-right" autoClose={3000} />
      <img src="/logo2.svg" alt="DFINITY logo" />
      <br />
      <br />

      {identity ? (
        <>
          <p>Logged in with Principal ID: {principalId}</p>
          <button onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <button onClick={handleLogin}>Login with NFID</button>
      )}

      {!identity && (
        <>
          <form onSubmit={handleGreetSubmit}>
            <label htmlFor="greet-name">Enter your name: &nbsp;</label>
            <input
              id="greet-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit">Greet Me!</button>
          </form>

          <section id="greeting">{greeting}</section>

          <form onSubmit={handleSetNameSubmit}>
            <label htmlFor="set-name">Set Your Name: &nbsp;</label>
            <input
              id="set-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit">Set Name</button>
          </form>

          <form onSubmit={handleUploadImage}>
            <label htmlFor="image-name">Image Name: &nbsp;</label>
            <input
              id="image-name"
              type="text"
              value={imageName}
              onChange={(e) => setImageName(e.target.value)}
            />
            <input
              id="image-data"
              type="file"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    setImageData(new Uint8Array(event.target.result));
                  };
                  reader.readAsArrayBuffer(file);
                }
              }}
            />
            <button type="submit">Upload Image</button>
          </form>

          <section id="all-images">
            <h2>All Images</h2>
            <ul>
              {allImages.map(({ id, name, creator, src }) => (
                <li key={id}>
                  <p>
                    ID: {id}, Name: {name}, Creator: {creator}
                  </p>
                  <img
                    src={src}
                    alt={name}
                    style={{ width: "100px", height: "auto" }}
                  />
                  <button onClick={() => handleDeleteImage(id)}>Delete</button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
