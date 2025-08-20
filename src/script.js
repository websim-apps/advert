import { marked } from 'marked';
import DOMPurify from 'dompurify';

(async () => {
    const hostname = window.location.hostname;
    if (hostname.endsWith('.on.websim.ai') || hostname.endsWith('.on.websim.com')) {
        try {
            // Visually indicate that a redirect is happening
            document.body.innerHTML = `
                <style>
                    body {
                        background-color: #1a1a1d;
                        color: #edf2f4;
                        font-family: 'Roboto', sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        height: 100vh;
                        margin: 0;
                    }
                </style>
                <div>Redirecting to project page...</div>
            `;
            const project = await window.websim.getCurrentProject();
            if (project && project.id) {
                window.location.href = `https://websim.com/p/${project.id}`;
            } else {
                 document.body.querySelector('div').textContent = 'Error: Could not find project ID.';
            }
        } catch (error) {
            console.error('Failed to redirect:', error);
            document.body.querySelector('div').textContent = `Error: Redirection failed.`;
        }
        return; // Stop further execution in this script
    }

    // If not on a redirect domain, proceed with the app initialization.
    init();
})();

const commentsContainer = document.getElementById('comments-container');
const commentForm = document.getElementById('comment-form');
const commentContentInput = document.getElementById('comment-content');
const commentTipInput = document.getElementById('comment-tip');
const submitButton = document.getElementById('submit-button');

let projectId;

async function init() {
    try {
        const project = await window.websim.getCurrentProject();
        projectId = project.id;
        
        await loadComments();

        commentForm.addEventListener('submit', handlePostComment);
        window.websim.addEventListener('comment:created', handleCommentCreated);

    } catch (error) {
        console.error("Initialization failed:", error);
        commentsContainer.innerHTML = `<p class="error-state">Could not load project data. Please try refreshing the page.</p>`;
    }
}

async function loadComments() {
    commentsContainer.innerHTML = '<div class="loader"></div>';
    try {
        // Fetch the top 50 comments, sorted by best score, filtering only for tips
        const response = await fetch(`/api/v1/projects/${projectId}/comments?sort_by=best&only_tips=true&first=50`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        commentsContainer.innerHTML = ''; // Clear loader

        if (data.comments.data.length === 0) {
            commentsContainer.innerHTML = `<p class="empty-state">No projects advertised yet. Be the first to post!</p>`;
        } else {
            data.comments.data.forEach((item, index) => {
                const commentEl = createCommentElement(item.comment, index);
                commentsContainer.appendChild(commentEl);
            });
        }
    } catch (error) {
        console.error("Failed to load comments:", error);
        commentsContainer.innerHTML = `<p class="error-state">Error loading comments.</p>`;
    }
}

function createCommentElement(comment, index) {
    const commentCard = document.createElement('div');
    commentCard.className = 'comment-card';
    commentCard.id = `comment-${comment.id}`;

    // Sanitize and parse markdown content
    const unsafeHTML = marked.parse(comment.raw_content);
    const safeHTML = DOMPurify.sanitize(unsafeHTML);

    const tipBanner = index === 0 ? '<div class="tip-banner">TOP TIP</div>' : '';

    commentCard.innerHTML = `
        <img src="${comment.author.avatar_url}" alt="${comment.author.username}'s avatar" class="comment-author-avatar">
        <div class="comment-main">
            <div class="comment-header">
                <span class="comment-author-username">${comment.author.username}</span>
            </div>
            <div class="comment-body">${safeHTML}</div>
            <div class="comment-tip-amount">${comment.card_data.credits_spent.toLocaleString()} Credits Tipped</div>
        </div>
        ${tipBanner}
    `;
    
    return commentCard;
}

async function handlePostComment(event) {
    event.preventDefault();
    submitButton.disabled = true;
    submitButton.textContent = 'Posting...';

    const content = commentContentInput.value;
    const credits = parseInt(commentTipInput.value, 10);

    if (!content.trim()) {
        alert('Please write something about your project.');
        submitButton.disabled = false;
        submitButton.textContent = 'Post Advertisement';
        return;
    }

    if (isNaN(credits) || credits < 10) {
        alert('Minimum tip is 10 credits.');
        submitButton.disabled = false;
        submitButton.textContent = 'Post Advertisement';
        return;
    }

    try {
        // This function opens a confirmation dialog for the user.
        await window.websim.postComment({
            content: content,
            credits: credits,
        });
        
    } catch (error) {
        console.error("Error opening comment dialog:", error);
        alert(`Failed to open comment dialog: ${error.message}`);
    } finally {
        // The user might cancel or confirm the post. In either case, re-enable the button.
        // The 'comment:created' event will handle success.
        submitButton.disabled = false;
        submitButton.textContent = 'Post Advertisement';
    }
}

function handleCommentCreated(eventData) {
    // A new comment was successfully posted.
    // Reset the form and reload the comments to show the new post in its correct rank.
    console.log('New comment detected:', eventData);
    commentForm.reset();
    loadComments();
}
