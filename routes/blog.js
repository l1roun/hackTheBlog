const express = require("express");

const db = require("../data/database");
const { authenticate } = require('../middleware/index')

const router = express.Router();

router.get("/", function(req, res) {
    res.redirect("/posts");
});



router.get("/posts", authenticate, async function(req, res) {
    const userID = req.user.userId;

    const query = `
    SELECT post.*, authors.name AS author_name FROM post 
    INNER JOIN authors ON post.author_id = authors.id 
    `;
    const [posts] = await db.query(query);
    res.render("posts-list", { posts: posts, currentUser: userID });
});





router.get("/new-post", authenticate, async function(req, res) {
    const userID = req.user.userId;

    res.render("create-post", { currentUser: userID });
});



router.post("/posts", authenticate, async function(req, res) {
    const userID = req.user.userId;

    const data = [
        req.body.title,
        req.body.summary,
        req.body.content,
        userID
    ];
    await db.query(
        "INSERT INTO post (title, summary, body, author_id) VALUES (?)", [data]
    );
    res.redirect("/posts");
});



router.get("/posts/:id", authenticate, async function(req, res) {
    const userID = req.user.userId;
    console.log(userID)

    // Query to get post details along with the number of likes and whether the current user has liked the post
    const query = `
    SELECT post.*, authors.name AS author_name, authors.email AS author_email, 
           COUNT(likes.id) AS likesCount, EXISTS(SELECT 1 FROM likes WHERE user_id = ? AND post_id = post.id) AS userLiked
    FROM post 
    INNER JOIN authors ON post.author_id = authors.id
    LEFT JOIN likes ON post.id = likes.post_id
    WHERE post.id = ?
    GROUP BY post.id
    `;

    const commentsQuery = 'SELECT comments.*, authors.name AS author_name FROM comments INNER JOIN authors ON comments.author_id = authors.id WHERE post_id = ?';

    try {
        const [posts] = await db.query(query, [userID, req.params.id]);
        const [comments] = await db.query(commentsQuery, [req.params.id]);

        if (!posts || posts.length === 0) {
            return res.status(404).render("404");
        }

        const postData = {
            ...posts[0],
            date: posts[0].date.toISOString(),
            humanReadableDate: posts[0].date.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
            likesCount: posts[0].likesCount || 0,
            userLiked: posts[0].userLiked === 1,
        };

        res.render("post-detail", { post: postData, comments, currentUser: userID });
    } catch (error) {
        console.error(error);
        res.status(500).render("500"); // Handle error appropriately, e.g., render a 500 page
    }
});
router.get("/posts/:id/edit", authenticate, async function(req, res) {
    const userID = req.user.userId;
    console.log(userID)
    const checkQuery = "SELECT * FROM post WHERE id = ? AND author_id = ?";
    const [Checkposts] = await db.query(checkQuery, [req.params.id, userID]);
    if ((!Checkposts || Checkposts.length === 0) && userID !== 1) {
        return res.status(403).render("403"); // User is not the author, show forbidden page
    }
    const Query = "SELECT * FROM post WHERE id = ?";
    const [posts] = await db.query(Query, [req.params.id]);
    res.render("update-post", { post: posts[0], currentUser: userID });
});

router.post("/posts/:id/edit", authenticate, async function(req, res) {
    const userID = req.user.userId;

    const checkQuery = "SELECT * FROM post WHERE id = ? AND author_id = ?";
    const [posts] = await db.query(checkQuery, [req.params.id, userID]);

    if ((!posts || posts.length === 0) && userID != 1) {
        res.redirect('/'); // User is not the author, show forbidden page
    }

    const query = `
    UPDATE post SET title = ?, summary = ?, body = ?
    WHERE id = ?
`;


    await db.query(query, [
        req.body.title,
        req.body.summary,
        req.body.content,
        req.params.id,
    ]);

    res.redirect("/posts");
});

router.post("/posts/:id/delete", authenticate, async function(req, res) {
    const userID = req.user.userId;

    const checkQuery = "SELECT * FROM post WHERE id = ? AND author_id = ?";
    const [posts] = await db.query(checkQuery, [req.params.id, userID]);

    if ((!posts || posts.length === 0) && userID != 1) {
        return res.status(403).render("403"); // User is not the author, show forbidden page
    }

    // Delete comments associated with the post
    const deleteCommentsQuery = "DELETE FROM comments WHERE post_id = ?";
    await db.query(deleteCommentsQuery, [req.params.id]);
    const deleteLikesQuery = "DELETE FROM likes WHERE post_id = ?";
    await db.query(deleteLikesQuery, [req.params.id]);

    // Delete the post
    const deletePostQuery = "DELETE FROM post WHERE id = ?";
    await db.query(deletePostQuery, [req.params.id]);

    res.redirect("/posts");
});



router.post("/posts/:postId/comments", authenticate, async function(req, res) {
    try {
        const postId = req.params.postId;
        const authorId = req.user.userId;
        const { content } = req.body;
        const query = 'INSERT INTO comments (post_id, author_id, content) VALUES (?, ?, ?)';
        await db.query(query, [postId, authorId, content]);

        res.redirect(`/posts/${postId}`)
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});




router.post('/edit-comment/:postid/:id', authenticate, async(req, res) => {
    const { newText } = req.body;
    console.log(newText)
    const [Query] = await db.query('select * from comments WHERE id = ?', [req.params.id]);
    comment = Query[0]
    if (req.user.userId === 1 || req.user.userId === comment.author_id) {
        // Update the comment in the database
        const query = `
        UPDATE comments SET content = ?
        WHERE id = ?
    `;


        await db.query(query, [
            req.body.newText,
            req.params.id,

        ]);

        res.redirect(`/posts/${req.params.postid}`);

    } else {
        // User is not authorized to delete the comment
        return res.status(404).render("404");
    }


});

router.delete('/delete-comment/:commentId', authenticate, async(req, res) => {
    const commentId = req.params.commentId;
    const [Query] = await db.query('select * from comments WHERE id = ?', [commentId]);
    comment = Query[0]
        // Check if the user is the owner of the comment or an admin

    if (req.user.userId === 1 || req.user.userId === comment.author_id) {
        // Delete the comment from the database
        const result = await db.query('DELETE FROM comments WHERE id = ?', [commentId]);

        if (result.length > 0) {
            res.status(200).redirect('/posts');
        }
    } else {
        // User is not authorized to delete the comment
        return res.status(404).render("404");
    }
});




router.post('/like/:post_id', authenticate, (req, res) => {

    try {
        const user_id = req.user.userId;
        const post_id = req.params.post_id;

        db.query('INSERT INTO likes (user_id, post_id) VALUES (?, ?)', [user_id, post_id])
        res.redirect(`/posts/${post_id}`)

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }

});

// Unlike a post
router.post('/unlike/:post_id', authenticate, (req, res) => {

    try {
        const user_id = req.user.userId;
        const post_id = req.params.post_id;

        db.query('DELETE FROM likes WHERE user_id = ? AND post_id = ?', [user_id, post_id])
        res.redirect(`/posts/${post_id}`)

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }

});

module.exports = router;