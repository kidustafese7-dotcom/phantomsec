// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
    getDatabase,
    ref,
    onValue
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyC1m2aJeAW93BkgQ0VUM9KdtzT2OZelM",
    authDomain: "phantomsec-ca297.firebaseapp.com",
    databaseURL: "https://phantomsec-ca297-default-rtdb.firebaseio.com",
    projectId: "phantomsec-ca297",
    storageBucket: "phantomsec-ca297.firebasestorage.app",
    messagingSenderId: "15497490169",
    appId: "1:15497490169:web:a8454e1ed0fda9de04fc28"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const booksContainer = document.getElementById("booksContainer");
const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");

let allBooks = [];

function openBook(book) {
    if (!book.pdfUrl) {
        alert("This book does not have a PDF link.");
        return;
    }

    try {
        const url = new URL(book.pdfUrl);

        if (!["https:", "http:"].includes(url.protocol)) {
            throw new Error("Invalid URL");
        }

        // Open the PDF link directly. The PDF host must allow access.
        window.open(url.href, "_blank", "noopener,noreferrer");
    } catch {
        alert("This book has an invalid PDF link.");
    }
}

function selectBook(book) {
    if (book.category === "premium") {
        const paymentUrl = new URL("payment/index.html", window.location.href);
        paymentUrl.searchParams.set("book", book.id);
        window.location.href = paymentUrl.href;
        return;
    }

    openBook(book);
}

function createBookCard(book) {
    const card = document.createElement("article");
    card.className = "book-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${book.category === "premium" ? "Buy" : "Read"} ${book.name || "book"}`);

    const title = document.createElement("h2");
    title.className = "book-title";
    title.textContent = book.name || "Untitled";

    const description = document.createElement("p");
    description.className = "book-description";
    description.textContent = book.description || "No description available.";

    const details = document.createElement("div");
    details.className = "book-details";

    const premium = book.category === "premium";
    const badge = document.createElement("span");
    badge.className = `book-category ${premium ? "premium" : "free"}`;
    badge.textContent = premium ? "Premium" : "Free";
    details.appendChild(badge);

    if (premium) {
        const price = document.createElement("span");
        price.className = "book-price";
        price.textContent = `${book.price || 0} ${book.currency || "ETB"}`;
        details.appendChild(price);
    }

    const button = document.createElement("button");
    button.className = "read-button";
    button.type = "button";
    button.textContent = premium ? "Buy book" : "Read book";
    button.addEventListener("click", (event) => {
        event.stopPropagation();
        selectBook(book);
    });

    card.addEventListener("click", () => selectBook(book));
    card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectBook(book);
        }
    });

    card.append(title, description, details, button);
    return card;
}

function renderBooks() {
    const query = (searchInput.value || "").trim().toLowerCase();
    const selectedCategory = categoryFilter.value || "all";

    const filteredBooks = allBooks.filter((book) => {
        const name = (book.name || "").toLowerCase();
        const description = (book.description || "").toLowerCase();

        return (
            (name.includes(query) || description.includes(query)) &&
            (selectedCategory === "all" || book.category === selectedCategory)
        );
    });

    booksContainer.replaceChildren();

    if (filteredBooks.length === 0) {
        const message = document.createElement("p");
        message.className = "empty-message";
        message.textContent = "No books found.";
        booksContainer.appendChild(message);
        return;
    }

    filteredBooks.forEach((book) => {
        booksContainer.appendChild(createBookCard(book));
    });
}

searchInput.addEventListener("input", renderBooks);
categoryFilter.addEventListener("change", renderBooks);

onValue(
    ref(database, "books"),
    (snapshot) => {
        const data = snapshot.val();

        allBooks = data
            ? Object.entries(data)
                .map(([id, book]) => ({ id, ...book }))
                .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            : [];

        renderBooks();
    },
    (error) => {
        console.error("Could not load books:", error);
        booksContainer.textContent = "Could not load books. Please try again later.";
    }
);