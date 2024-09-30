import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import bcrypt from "bcrypt";
import 'dotenv/config';
import pg from 'pg';
import LocalStrategy from "passport-local";
import GoogleStrategy from "passport-google-oauth20";
import FacebookStrategy from "passport-facebook";
import TwitterStrategy from "passport-twitter";
import session from 'express-session';
import passport from "passport";

const app = express();
const port = 3000;
const API_URL = "http://localhost:4000";

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

//Session support to the application.
app.use(session({
  secret: process.env['SESSION_SECRET'],
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
  }
}));

//authenticate the session.
app.use(passport.initialize());
app.use(passport.session());

// Connect to database.
const db = new pg.Client({
  user: process.env['DB_USER'],
  host: process.env['DB_HOST'],
  database: process.env['DB_DATABASE'],
  password: process.env['DB_PASSWORD'],
  port: process.env['DB_PORT']
});
await db.connect();

var postAuthorBool;
var postAuthorName;
var errMsg = "";
var errMsgBool;
var pseudoname;

//Load main page, get all posts from api.
app.get("/", async  (req,res) => {
  if(postAuthorBool) {
    postAuthorName = "";
  } else {
    postAuthorBool = true;
  }
  if (req.user && req.isAuthenticated) {
    try {
      const response = await allPostsFromApi();
      const pseudoname = (await db.query("SELECT pseudoname FROM users WHERE username = $1 AND password = $2", [req.user.username, req.user.password])).rows[0].pseudoname;
      if (response.data.length != 0) {
        if (postAuthorName) {
          var userPosts = finduserPosts(response, postAuthorName);
        }
        const allAuthors = addAuthorsToArray(response.data);
        res.render("index.ejs", {posts: postAuthorName ? userPosts : response.data, userName: pseudoname ? pseudoname : req.user.username, allAuthors: allAuthors});
      } else {
        res.render("index.ejs", {userName: pseudoname ? pseudoname : req.user.username});
      }
    } catch (error) {
        res.status(500).json({ message: "Error fetching posts" });
    }
  } else {
    try {
      const response = await allPostsFromApi();
      if (response.data.length != 0) {
        if (postAuthorName) {
          var userPosts = finduserPosts(response, postAuthorName);
        }
        const allAuthors = addAuthorsToArray(response.data);
        res.render("index.ejs", { posts: postAuthorName ? userPosts : response.data, allAuthors: allAuthors});
      } else {
        res.render("index.ejs");
      }
      } catch (error) {
          res.status(500).json({ message: "Error fetching posts" });
      }
  }
});
      

//Load post.ejs.
app.get("/new", async (req,res) => {
  try {
    const response = await axios.get(`${API_URL}/allPosts`);
    const allAuthors = addAuthorsToArray(response.data);
    response.data.forEach(post => {
      if (!allAuthors.includes(post.author)) {
        allAuthors.push(post.author)
      }
    });
    if (req.isAuthenticated()) {
      const pseudoname = (await db.query("SELECT pseudoname FROM users WHERE username = $1 AND password = $2", [req.user.username, req.user.password])).rows[0].pseudoname;
      res.render("post.ejs", {userName: pseudoname ? pseudoname : req.user.username, allAuthors: allAuthors})
    } else {
      res.redirect("/login");
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

//Load Login page.
app.get("/login", (req,res) => {
  if (!req.isAuthenticated()) {
    if(errMsgBool === false) errMsgBool = true;
    else errMsg = "";
    res.render("login.ejs", {errMsg: errMsg});
  } else {
    res.redirect("/");
  }
});

//Render post.ejs - create, handle if any input was empty.
app.post("/create", async (req, res) => {
  const { title, content, author } = req.body;
  if (title < 1 || content < 1 || author < 1) {
    res.redirect("/new");
  } else {
    try {
      var validPost = false;
      const checkAuthorExists = await db.query("SELECT id, password FROM users WHERE pseudoname = $1", [author]);
      const storedUser = await db.query("SELECT * FROM users WHERE username = $1 AND password = $2",[req.user.username, req.user.password]);
      //Check that the name of the selected author is assigned
      if(checkAuthorExists.rows.length === 0) {
        await db.query("UPDATE users SET pseudoname = $1 WHERE id = $2", [author, storedUser.rows[0].id]);
        validPost = true;
      } else {
        if (storedUser.rows[0].pseudoname !== author) {
          //user tring use pseudoname another user
          errMsgBool = false;
          errMsg = "Author name is already taken!"
          res.redirect("/new")
        } else {
          validPost = true;
        }
      }
      if(validPost) {
        await axios.post(`${API_URL}/posts`, req.body);
        res.redirect("/");
      }
    } catch (error) {
      res.status(500).json({ message: "Error creating post" });
    }
  }
});

//Render post.ejs - edit(update or delete)
app.post("/edit/:id", async (req,res) => {
    if (req.isAuthenticated()) {
      try { 
        const response = await axios.get(`${API_URL}/posts/${req.params.id}`)
        res.render("post.ejs", { act: req.body.btn, content: response.data})
      } catch (error) {
        res.status(500).json({ message: "Error editing post" });
      }
    } else {
      res.redirect("/")
    }
});

//Update post
app.post("/update/:id", async (req,res) => {
  if (req.isAuthenticated()) {
    try {
      await axios.patch(`${API_URL}/update/${req.params.id}`, req.body);
      res.redirect("/")
    } catch (error) {
      res.status(500).json({ message: "Error updating post" });
    }
  }
});

//Delete post
app.post("/delete/:id", async (req,res) => {
  if (req.isAuthenticated()) {
    try {
      const response = await axios.delete(`${API_URL}/delete/${req.params.id}`);
      console.log("Deleted post: ", response.data);
      res.redirect("/")
    } catch (error) {
      res.status(500).json({ message: "Error deleting post" });
    }
  }
});

//Find posts by choosen author
app.post("/findPosts", async (req,res) => {
  if (req.body.authors) {
    postAuthorName = req.body.authors;
    postAuthorBool = false;
    res.redirect("/")
  }
  else if(req.isAuthenticated()) {
    try {
      const response = await db.query("SELECT pseudoname FROM users WHERE username = $1 AND password = $2",[req.user.username, req.user.password]);
      postAuthorName = response.rows[0].pseudoname;
      postAuthorBool = false;
      res.redirect("/")
    } catch(err) {
      console.log(err);
    };
  } else {
    res.redirect("/login")
  }
  });

  //Add like
  app.post("/likeDislike", async (req,res) => {
      if (req.isAuthenticated()) {
      const { username, password }= req.user;
      const userId = (await db.query("SELECT id FROM users WHERE username = $1 AND password = $2", [username, password])).rows[0].id;
      const like = req.body.addButton ? req.body.addButton : req.body.removeButton;
      const state = req.body.addButton ? 1 : 0;
      const response = await db.query("SELECT post_like FROM likes WHERE user_id = $1 AND post_id = $2", [userId, like]);
      if (response.rows.length > 0) {
        if (response.rows[0].post_like === state) {
          await db.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [userId, like]);
        } else if (response.rows[0].post_like !== state) {
          await db.query("UPDATE likes SET post_like = $1 WHERE user_id = $2 AND post_id = $3", [state, userId, like]);
        }
      } else {
        await db.query("INSERT INTO likes (user_id, post_id, post_like) VALUES ($1, $2, $3)", [userId, like, state]);
      }
    }
    res.redirect("/");
  });

//Local login
app.post('/login', async (req, res, next) => {
  if (!req.body.confirm) {
  const name = (await db.query("SELECT * FROM users WHERE username = $1", [req.body.username])).rows
    if (name.length < 1) {
      errMsgBool = false;
      errMsg = "Name do not exists!";
      res.redirect("/login")
    }
    else {
    next();
    }
  } else {
    const {password, confirm} = req.body;
    if (password !== confirm) {
      errMsgBool = false;
      errMsg = "The passwords are not the same !";
      res.redirect("/login")
    } else {
      pseudoname = req.body.pseudoname;
      next();
    }
  };
},
  passport.authenticate('local', { failureRedirect: '/login'}),
  (req, res) => {
     // issue cookie I don't remember if the option was unchecked
     if (!req.body.remember_me) {
      req.session.cookie.expires = false;
     }
     res.redirect("/");
    }
);

//Logout
app.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) { return next(err); }
    res.redirect('/');
  });
});
 

//Login with Google
app.get("/oauth2/redirect/google", passport.authenticate('google', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

//Login with Facebook
app.get("/oauth2/redirect/facebook", passport.authenticate('facebook', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

//Login with Twitter
app.get("/oauth1/redirect/twitter", passport.authenticate('twitter', {
  successRedirect: '/',
  failureRedirect: '/login'
}));

//Local Strategy
passport.use('local', new LocalStrategy(
  async (email, password, cb) => {
    const saltRounds = 10;
    try {
      const response = await db.query("SELECT * FROM users WHERE username = $1", [email]);
      if (response.rows.length === 0) {
        bcrypt.genSalt(saltRounds, async (err, salt) => {
          if (err) {return cb(err)}
          bcrypt.hash(password, salt, async (err, hash) => {
            if (err) {return cb(err)}
              await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [email, hash]);
              const user = {
                username: email,
                password: hash
              };
              return cb(null, user)
          });
      });
      } else {
        const hash = response.rows[0].password;
        bcrypt.compare(password, hash, async function(err, result) {
          if (err) {cb(err)}
          else if (result) {
            const user = {
              username: email,
              password: hash
            };
            return cb(null, user);
          } else {
            errMsgBool = false;
            errMsg = "Incorrect password!"
            return cb(null, false);
          }

      });
      }
  } catch(err) {
    return cb(err);
  }
  }
));

//Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env['GOOGLE_CLIENT_ID'],
  clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
  callbackURL: '/oauth2/redirect/google',
  scope: ['profile']
}, async (accessToken, refreshToken, profile, cb) => {
    try {
      const response = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [profile.displayName, profile.id]);
      const user = {
        username: profile.displayName,
        password: profile.id
      }
      if (response.rows.length === 0) {
          await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [profile.displayName, profile.id]);
            return cb(null, user);
        } else {
            return cb(null, user);
        }
      } catch(err) {
        console.log(err);
        cb(err);
      };
}
));

//Facebook Strategy
passport.use(new FacebookStrategy({
  clientID: process.env['FACEBOOK_CLIENT_ID'],
  clientSecret: process.env['FACEBOOK_CLIENT_SECRET'],
  callbackURL: "http://localhost:3000/oauth2/redirect/facebook"
},
async (accessToken, refreshToken, profile, cb) => {
  try {
    const response = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [profile.displayName, profile.id]);
    const user = {
      username: profile.displayName,
      password: profile.id
    }
    if (response.rows.length === 0) {
      await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [profile.displayName, profile.id]);
      return cb(null, user)
    } else {
      return cb(null, user)
    }
  } catch(err) {
    console.log(err);
    cb(err);
  };
}
));

//Twitter Strategy
passport.use(new TwitterStrategy({
  consumerKey: process.env["TWITTER_CLIENT_ID"],
  consumerSecret: process.env["TWITTER_CLIENT_SECRET"],
  callbackURL: "http://localhost:3000/oauth1/redirect/twitter",
},
async (token, tokenSecret, profile, cb) => {
  try {
    const response = await db.query('SELECT * FROM users WHERE username = $1 AND password = $2', [profile.displayName, profile.id]);
    const user = {
      username: profile.displayName,
      password: profile.id
    }
    if (response.rows.length === 0) {
      await db.query('INSERT INTO users (username, password) VALUES ($1, $2)', [profile.displayName, profile.id]);
      return cb(null, user)
    } else {
      return cb(null, user)
    }
  } catch(err) {
    console.log(err);
    cb(err);
  };
}
));


passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(user, cb) {
  cb(null, user);
});

async function allPostsFromApi() {
  try {
    const response = await axios.get(`${API_URL}/allPosts`);
    return response;
  } catch(err) {
    return err;
  }
};

function finduserPosts(response, postAuthorName) {
  let userPosts = response.data.filter((post) => post.author === postAuthorName)
  return userPosts;
};

function addAuthorsToArray(response) {
  const allAuthors = []
  response.forEach(post => {
    if (!allAuthors.includes(post.author)) {
      allAuthors.push(post.author)
    }
  });
  return allAuthors;
};

app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});