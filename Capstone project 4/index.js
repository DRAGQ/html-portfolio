import express from "express";
import axios from "axios";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({extended: false}))

app.get("/", async (req,res) => {
        res.render("index.ejs");
});

app.post("/animal", async (req, res) => {
    try {
        //processing the user's request for a picture of a cat, dog or fox.
        if (req.body.cat === "cat") {
            const result = await axios.get("https://api.thecatapi.com/v1/images/search");
            res.render("index.ejs", {animalImg: (result.data[0].url)});
        }
         
        else if (req.body.dog === "dog") {
            var result = await axios.get("https://random.dog/woof.json");
            //I want to know if result is image or mp4.
            var format = result.data.url.slice(-3);
            while (format == "mp4" || format == "ebm") {
                result = await axios.get("https://random.dog/woof.json");
                format = result.data.url.slice(-3)
            }
            res.render("index.ejs", {animalImg: result.data.url});
            
        } else {
            const result = await axios.get("https://randomfox.ca/floof");
            //I want to know if result is image or mp4.
            res.render("index.ejs", {animalImg: result.data.image});
        }

    } catch (error) {
        console.log("Server error");
        res.render(500);
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}.`)
});