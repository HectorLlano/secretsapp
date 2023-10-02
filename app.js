//jshint esversion:6
import "dotenv/config";
import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
// import md5 from "md5"; // use to generate a hash for the password
import bcrypt from "bcrypt";

// define the number of rounds for salting
const saltRounds = 10;

// setting up server
const app = express();
const port = 3000;

// middleware
app.use(express.static("public"));
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// database url
const dbUrl = "mongodb://localhost:27017/newUserDB";

// connecting to the database and if succeded, connect to the server
main()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => console.log(err));

async function main() {
  await mongoose.connect(dbUrl);
}

// create a new mongoose schema for the data to be store
const credentialSchema = new mongoose.Schema({
  username: String,
  password: String,
});

// compiling the schema into a mongoose Model
const Credential = mongoose.model("Credential", credentialSchema);

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", (req, res) => {
  // start encripting the password from the begining
  bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
    // store the username and pass into a variable and store the hash as a password
    const newUserCredentials = {
      username: req.body.username,
      password: hash,
    };
    // try to find if the username already exists. if so, return a message to try again or login. if not, register new user and send back the home page
    Credential.findOne({ username: newUserCredentials.username })
      .then((doc) => {
        if (doc === null) {
          console.log("register");
          const newUser = new Credential(newUserCredentials);
          newUser.save();
          res.render("secrets.ejs");
        } else {
          res.render("register.ejs", {
            message: `Username already exist. Please try again or `,
          });
        }
      })
      .catch((err) => console.log(err));
  });
});

app.post("/login", (req, res) => {
  // store the username and pass into a variable
  const loginCedentials = {
    username: req.body.username,
    password: req.body.password,
  };

  // try to find if the username already exists. if so, send back the home page, if not or if password incorrect, send message back
  Credential.findOne({ username: loginCedentials.username })
    .then((doc) => {
      if (doc === null) {
        res.render("login.ejs", {
          message: "Username doesn't exist. Please try again or ",
        });
      } else {
        bcrypt.compare(
          loginCedentials.password,
          doc.password,
          function (err, result) {
            if (result) {
              console.log("granted");
              res.render("secrets.ejs");
            } else {
              res.render("login.ejs", {
                error: "Password incorrect. Please try again.",
              });
            }
          }
        );
      }
    })
    .catch((err) => console.log(err));
});
