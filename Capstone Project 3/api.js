import express from "express";
import bodyParser from "body-parser";
import pg from 'pg';
import 'dotenv/config';

const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Connect to database.
const db = new pg.Client({
  user: process.env['DB_USER'],
  host: process.env['DB_HOST'],
  database: process.env['DB_DATABASE'],
  password: process.env['DB_PASSWORD'],
  port: process.env['DB_PORT']
});
await db.connect();

//Array of all posts.
var posts = [];

//Send all posts or send posts by name
app.get("/allPosts", async (req, res) => {
    posts = [];
    try {
      //Convert date and add author into posts array and add count of likes and dislikes.
      posts = (await db.query("SELECT * FROM posts")).rows
      for (const post of posts) {
        let result = await db.query("SELECT pseudoname FROM users WHERE id = $1", [post.user_id]);
        let username = result.rows[0].pseudoname;
        post.author = username;
        const d = new Date(post.post_date);
        post.post_date = d.getDate() + ". " + (d.getMonth() + 1) + ". " + d.getFullYear();
        const like = (await db.query("SELECT COUNT(*) FROM likes WHERE post_id = $1 AND post_like = $2", [post.id, 1])).rows;
        const dislike = (await db.query("SELECT COUNT(*) FROM likes WHERE post_id = $1 AND post_like = $2", [post.id, 0])).rows;
        post.like = like[0].count;
        post.dislike = dislike[0].count
      }
      res.json(posts);

    } catch(err) {
     console.log(err)
    }
  });

  //Add new post
  app.post("/posts", async (req, res) => {
    try {
      const { title, content, author } = req.body;
      const userId = (await db.query("SELECT id FROM users WHERE pseudoname = $1", [author])).rows[0].id;
      const post = (await db.query(
        "INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3) RETURNING *",
        [title, content, userId])).rows[0];
        res.json(post);
    } catch(err) {
     console.log(err)
    }
  });

  //Find post by id
  app.get("/posts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const post = posts.find(post => post.id === id );
    res.json(post)
  });

  //Update post by id
  app.patch("/update/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const post = posts.find(post => post.id === id);
    if (!post) return res.status(404).json({ error: "Post not found!" });

    const newPost = {
      title: req.body.title || post.title,
      content: req.body.content || post.content,
      author: req.body.author,
      date: new Date().toDateString(),
    };
    try {
      await db.query(`UPDATE posts
        SET title = $1, content = $2, post_date = $3 WHERE id = $4`,
        [newPost.title, newPost.content, newPost.date, id]);
      await db.query(`UPDATE users
        SET pseudoname = $1 WHERE id = $2`,
        [newPost.author, post.user_id]);
      res.json(newPost)
    } catch(err) {
      console.log(err);
    }
  });

   //Delete post by id
  app.delete("/delete/:id", (req, res) => {
    const id = parseInt(req.params.id);
    const index = posts.findIndex(post => post.id === id);
    if (!posts[index]) return res.status(404).json({ error: "Post not found!" });
    try {
      db.query("DELETE FROM posts * WHERE id = $1", [id])
      res.status(200).send(`Post with index ${index} has been deleted`)
    } catch(err) {
      console.log(err);
    }
  });

app.listen(port, () => {
    console.log(`API is running at http://localhost:${port}`);
  });
  