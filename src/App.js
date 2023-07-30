import { useState, useEffect } from "react";
import { NFTStorage, File } from "nft.storage";
import { Buffer } from "buffer";
import { ethers } from "ethers";
import axios from "axios";

// Components
import Spinner from "react-bootstrap/Spinner";
import Navigation from "./components/Navigation";

// ABIs
import NFT from "./abis/NFT.json";

// Config
import config from "./config.json";

function App() {
  const [provider, setProvider] = useState(null);
  const [account, setAccount] = useState(null);
  const [nft, setNFT] = useState(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [url, setURL] = useState(null);

  const [message, setMessage] = useState("");
  const [isWaiting, setIsWaiting] = useState(false);

  const loadBlockchainData = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    setProvider(provider);

    const network = await provider.getNetwork();

    const nft = new ethers.Contract(
      config[network.chainId].nft.address,
      NFT,
      provider
    );
    setNFT(nft);
    //refresh account
    window.ethereum.on("accountsChanged", async () => {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
       const account = ethers.utils.getAddress(accounts[0]);
       setAccount(account);
    });
  };

  const submitHandler = async (e) => {
    e.preventDefault();

    if (name === "" || description === "") {
      window.alert("Please provide a name and description");
      return;
    }

    setIsWaiting(true);

    // Call AI API to generate a image based on description
    const imageData = await createImage();

    // Upload image to online storage
    const url = await uploadImage(imageData);
    // Mint NFT
    await mintImage(url);

    setIsWaiting(false);
    setMessage("");
    setName("");
    setDescription("");
  };

  async function createImage() {
    setMessage("Generating Image...");
    const URL = `https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1`;

    // Send the request
    const response = await axios({
      url: URL,
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.REACT_APP_HUGGING_FACE_API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        inputs: description,
        options: { wait_for_model: true },
      }),
      responseType: "arraybuffer",
    });
    const type = response.headers["content-type"];
    const data = response.data;
    const base64data = Buffer.from(data).toString("base64");
    const img = `data:${type};base64,` + base64data; // <-- This is so we can render it on the page
    setImage(img);

    return base64data;
  }

  const uploadImage = async (imageData) => {
    setMessage("Uploading Image...");
    var bodyFormData = new FormData();
    bodyFormData.append("image", imageData);

    const response = await axios({
      url: `https://api.imgbb.com/1/upload?name=${name}&key=${process.env.REACT_APP_IMGBB_API_KEY}`,
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "multipart/form-data",
      },
      data: bodyFormData,
    });

    const data = response.data;
    const url = data.data.url;
    setURL(url);

    return url;
  };

  const mintImage = async (tokenURI) => {
    setMessage("Waiting for Mint...");

    const signer = await provider.getSigner();
    const transaction = await nft
      .connect(signer)
      .mint(tokenURI, { value: ethers.utils.parseUnits("1", "ether") });
    await transaction.wait();
  };

  useEffect(() => {
    loadBlockchainData();
  }, []);

  return (
    <div>
      <Navigation account={account} setAccount={setAccount} />

      <div className="form">
        <form onSubmit={submitHandler}>
          <input
            disabled={isWaiting}
            type="text"
            placeholder="Create a name..."
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
          />
          <input
            disabled={isWaiting}
            type="text"
            value={description}
            placeholder="Create a description..."
            onChange={(e) => setDescription(e.target.value)}
          />
          <input type="submit" value="Create & Mint" />
          {isWaiting ? (
            <p>
              <Spinner animation="border" />
              &nbsp;&nbsp;&nbsp;
              <span> {message}</span>
            </p>
          ) : url ? (
            <p>
              View&nbsp;
              <a href={url} target="_blank" rel="noreferrer">
                {url.substring(url.lastIndexOf("/") + 1)}
              </a>
            </p>
          ) : (
            <></>
          )}
        </form>

        <div className="image">
          {!isWaiting && image ? (
            <img src={image} alt="AI generated image" />
          ) : isWaiting ? (
            <div className="image__placeholder">
              <Spinner animation="border" />
            </div>
          ) : (
            <></>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
