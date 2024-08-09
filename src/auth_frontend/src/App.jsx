import React, { useState, useEffect } from "react";
import { AuthClient } from "@dfinity/auth-client";
import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../declarations/auth_backend/auth_backend.did.js";
import { canisterId } from "../../declarations/auth_backend/index.js";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Null } from "@dfinity/candid/lib/cjs/idl";

// Define constants for authentication
const days = BigInt(1);
const hours = BigInt(24);
const nanoseconds = BigInt(3600000000000);

const defaultOptions = {
  createOptions: {
    idleOptions: {
      disableIdle: true,
    },
  },
  loginOptions: {
    identityProvider:
      process.env.DFX_NETWORK === "ic"
        ? "https://identity.ic0.app/#authorize"
        : `http://rdmx6-jaaaa-aaaaa-aaadq-cai.localhost:4943#authorize`,
    maxTimeToLive: days * hours * nanoseconds,
  },
};

function App() {
  const [authClient, setAuthClient] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [authActor, setAuthActor] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [name, setName] = useState("");
  const [imageName, setImageName] = useState("");
  const [imageData, setImageData] = useState(null);
  const [allImages, setAllImages] = useState([]);

  useEffect(() => {
    initAuth();
  }, []);

  async function initAuth() {
    try {
      const client = await AuthClient.create(defaultOptions.createOptions);
      setAuthClient(client);

      if (await client.isAuthenticated()) {
        handleAuthenticated(client);
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      toast.error("Error initializing authentication: " + error.message);
    }
  }

  async function handleAuthenticated(client) {
    try {
      const identity = await client.getIdentity();
      setIdentity(identity);

      const agent = new HttpAgent({ identity });
      if (process.env.NODE_ENV !== "production") {
        agent.fetchRootKey().catch((err) => {
          console.warn(
            "Unable to fetch root key. Check to ensure that your local replica is running"
          );
          console.error(err);
        });
      }

      const newAuthActor = await Actor.createActor(idlFactory, {
        agent,
        canisterId,
      });

      setAuthActor(newAuthActor);

      toast.success("Authenticated successfully!");
      fetchImages();
    } catch (error) {
      console.error("Authentication error:", error);
      toast.error("Error handling authentication: " + error.message);
    }
  }

  async function handleLogin() {
    try {
      await authClient.login({
        ...defaultOptions.loginOptions,
        onSuccess: () => {
          console.log("Login successful");
          handleAuthenticated(authClient);
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Login failed: " + error.message);
    }
  }

  async function handleLogout() {
    try {
      await authClient.logout();
      setIdentity(null);
      setAuthActor(null);
      toast.success("Logged out successfully!");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Logout failed: " + error.message);
    }
  }

  async function handleGreetSubmit(event) {
    event.preventDefault();
    try {
      if (!authActor) {
        toast.error("Not authenticated");
        return;
      }
      const greeting = await authActor.greet(name);
      setGreeting(greeting);
      toast.success("Greeting received!");
    } catch (error) {
      console.error("Greet error:", error);
      toast.error("Error greeting: " + error.message);
    }
  }

  async function handleSetNameSubmit(event) {
    event.preventDefault();
    try {
      if (!authActor) {
        toast.error("Not authenticated");
        return;
      }
      await authActor.set_name(name);
      toast.success("Name set successfully!");
    } catch (error) {
      console.error("Set name error:", error);
      toast.error("Error setting name: " + error.message);
    }
  }

  async function handleUploadImage(event) {
    event.preventDefault();
    if (!authActor) {
      toast.error("Not authenticated");
      return;
    }
    if (imageData && imageName) {
      try {
        const id = await authActor.upload_image(
          imageName,
          Array.from(imageData)
        );
        toast.success("Image uploaded successfully with ID: " + id);
        fetchImages();
      } catch (error) {
        console.error("Upload image error:", error);
        toast.error("Error uploading image: " + error.message);
      }
    } else {
      toast.error("Please select an image to upload.");
    }
  }

  async function handleDeleteImage(id) {
    if (!authActor) {
      toast.error("Not authenticated");
      return;
    }
    try {
      console.log(`Attempting to delete image with ID: ${id}`);
      const result = await authActor.delete_image(id);
      console.log("Delete result:", result);

      if ("Success" in result) {
        toast.success("Image deleted successfully!");
        fetchImages(); // Refresh the image list
      } else if ("NotAuthorized" in result) {
        toast.error("You are not authorized to delete this image.");
      } else if ("NotFound" in result) {
        toast.error("Image not found.");
      } else {
        toast.error("An unexpected error occurred while deleting the image.");
      }
    } catch (error) {
      console.error("Delete image error:", error);
      if (error instanceof Error) {
        toast.error("Error deleting image: " + error.message);
      } else {
        toast.error("An unexpected error occurred while deleting the image");
      }
    }
  }

  async function fetchImages() {
    if (!authActor) {
      toast.error("Not authenticated");
      return;
    }
    try {
      console.log("Fetching images...");
      const images = await authActor.get_all_images([100]); // Fetch up to 100 images
      console.log("Raw images data:", images);

      const imageList = images.map(([id, name, creator, data]) => {
        // Convert ArrayBuffer to Base64
        const uint8Array = new Uint8Array(data);
        const chunks = [];
        const chunkSize = 0xffff;
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          chunks.push(
            String.fromCharCode.apply(
              null,
              uint8Array.subarray(i, i + chunkSize)
            )
          );
        }
        const base64Data = btoa(chunks.join(""));
        const imageSrc = `data:image/jpeg;base64,${base64Data}`;
        return { id, name, creator, src: imageSrc };
      });

      console.log("Processed image list:", imageList);
      setAllImages(imageList);
    } catch (error) {
      console.error("Fetch images error:", error);
      if (error instanceof Error) {
        toast.error("Error fetching images: " + error.message);
      } else {
        toast.error("An unexpected error occurred while fetching images");
      }
    }
  }

  async function whoami() {
    try {
      if (!authActor) {
        toast.error("Not authenticated");
        return;
      }
      console.log("Current identity:", identity.getPrincipal().toString());
      const me = await authActor.whoami();
      console.log("Whoami result:", me);
      toast.success(JSON.stringify(me));
    } catch (error) {
      console.error("Whoami error:", error);
      toast.error(error.message);
    }
  }

  return (
    <main>
      <img src="/logo2.svg" alt="DFINITY logo" />
      <br />
      <br />

      {identity && authActor ? (
        <>
          <p>Logged in as: {identity.getPrincipal().toString()}</p>
          <button onClick={handleLogout}>Logout</button>

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
          <button onClick={fetchImages}>Get All Images</button>
          <button onClick={whoami}>Whoami</button>
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
      ) : (
        <button onClick={handleLogin}>Login with Internet Identity</button>
      )}

      <ToastContainer />
    </main>
  );
}

export default App;
