const jwt = require("jsonwebtoken");
const express = require("express");
const db = require("../data/database");
const { createToken } = require('../utils');
const { authenticate } = require('../middleware/index')
const jwt_secret = "NotSecureSecret"
const router = express.Router();
const MaxAge = 3 * 24 * 60 * 60;
const { genSalt, hash, compare } = require('bcrypt'); // Assuming you're using bcrypt for password hashing

router.post("/signup", async(req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).send('Please provide username, password, and email');
    }

    try {
        // Check if the username is already taken
        const [usernameCheck] = await db.query('SELECT * FROM authors WHERE name = ?', [username]);

        // Check the actual data (rows) returned by the query
        if (usernameCheck.length > 0) {
            // The username is already taken
            return res.status(400).send('Username already taken');
        }

        // Hash the password before storing it
        const hashedPassword = await hash(password, 10);
        console.log('Hashed Password for Registration:', hashedPassword);

        // Insert the new user into the database
        const result = await db.query('INSERT INTO authors (name, password, email) VALUES (?, ?, ?)', [username, hashedPassword, email]);

        // Assuming user.id is the primary key of your users table

        res.redirect('/login');
    } catch (error) {
        // Handle other errors or log them
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


router.post("/login", async(req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send('Please provide username and password');
    }

    try {
        const [result] = await db.query('SELECT * FROM authors WHERE name = ?', [username]);

        if (result.length === 0) {
            return res.status(401).send('no User with this Username');
        }

        const user = result[0];

        // Log relevant information for debugging

        console.log('Entered Password:', password);
        console.log(' password from db:', user.password);
        const isPasswordCorrect = await compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(401).send('Invalid Credentials');
        }


        const token = createToken(user.id); // Assuming user.id is the primary key of your users table
        res.cookie('jwt', token, { httpOnly: true, maxAge: MaxAge * 1000 });
        res.redirect('/');
    } catch (error) {
        // Handle other errors or log them
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


router.get("/login", async function(req, res) {
    const token = req.cookies.jwt;

    if (token) {
        try {
            const decoded = jwt.verify(token, jwt_secret);
            res.redirect('/profile')
        } catch (err) {
            return res.status(401).send('Invalid token.');
        }
    }

    res.render("login");
});

router.get("/signup", async function(req, res) {
    const token = req.cookies.jwt;

    if (token) {
        try {
            const decoded = jwt.verify(token, jwt_secret);
            res.redirect('/profile')
        } catch (err) {
            return res.status(401).send('Invalid token.');
        }
    }

    res.render("signup");
});


router.get("/logout", authenticate, async function(req, res) {
    res.clearCookie('jwt')
    res.redirect('/');

});
router.get("/profile", authenticate, async function(req, res) {
    const userID = req.user.userId;
    const [result] = await db.query('SELECT * FROM authors WHERE id = ?', [userID]);

    if (result.length > 0) {
        const user = result[0];
        const query = `
        SELECT post.*, authors.name AS author_name FROM post 
            INNER JOIN authors ON post.author_id = authors.id
            WHERE post.author_id = ?
        `;
        const [posts] = await db.query(query, [userID]);
        res.render('profile', { posts: posts, username: user.name, email: user.email, currentUser: userID });
    } else {
        res.redirect('/login')
    }
});

module.exports = router;