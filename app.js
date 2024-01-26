const path = require('path');

const express = require('express');

const blogRoutes = require('./routes/blog');
const userRoutes = require('./routes/login');
const cookieParser = require('cookie-parser');

const app = express();
port = 3000
    // Activate EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(cookieParser());

app.use(express.urlencoded({ extended: true })); // Parse incoming request bodies
app.use(express.static('public')); // Serve static files (e.g. CSS files)

app.use(blogRoutes);
app.use(userRoutes);

app.use(function(error, req, res, next) {

    console.log(error);
    res.status(500).render('500');
});

app.listen(port, () =>
    console.log(`Server is listening on port ${port}...`)
);