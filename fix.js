const fs = require('fs');
const path = require('path');

const dir = '/Users/idanmevasem/Desktop/Calcala news/admin';
const jsDir = path.join(dir, 'js');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');

    content = content.replace(/href="css\//g, 'href="/admin/css/');
    content = content.replace(/src="js\//g, 'src="/admin/js/');
    content = content.replace(/href="dashboard"/g, 'href="/admin/dashboard"');
    content = content.replace(/href="categories"/g, 'href="/admin/categories"');
    content = content.replace(/href="leads"/g, 'href="/admin/leads"');
    content = content.replace(/href="quiz-config"/g, 'href="/admin/quiz-config"');
    content = content.replace(/href="article-edit/g, 'href="/admin/article-edit');

    fs.writeFileSync(filePath, content);
});

// dashboard
let dash = fs.readFileSync(path.join(dir, 'dashboard.html'), 'utf8');
dash = dash.replace(/window\.authUtils\.checkAuth\(\);\s*/g, '');
dash = dash.replace(/loadArticles\(\);/g, 'window.authUtils.checkAuth().then(isAuth => { if(isAuth) loadArticles(); });');
fs.writeFileSync(path.join(dir, 'dashboard.html'), dash);

// categories
let cats = fs.readFileSync(path.join(dir, 'categories.html'), 'utf8');
cats = cats.replace(/window\.authUtils\.checkAuth\(\);\s*/g, '');
cats = cats.replace(/loadCategories\(\);/g, 'window.authUtils.checkAuth().then(isAuth => { if(isAuth) loadCategories(); });');
fs.writeFileSync(path.join(dir, 'categories.html'), cats);

// leads
let leads = fs.readFileSync(path.join(dir, 'leads.html'), 'utf8');
leads = leads.replace(/checkAuth\(\);\s*/g, '');
leads = leads.replace(/init\(\);/g, 'window.authUtils.checkAuth().then(isAuth => { if(isAuth) init(); });');
fs.writeFileSync(path.join(dir, 'leads.html'), leads);

// quiz-config
let quiz = fs.readFileSync(path.join(dir, 'quiz-config.html'), 'utf8');
quiz = quiz.replace(/checkAuth\(\);\s*/g, '');
quiz = quiz.replace(/init\(\);/g, 'window.authUtils.checkAuth().then(isAuth => { if(isAuth) init(); });');
fs.writeFileSync(path.join(dir, 'quiz-config.html'), quiz);

// js/article-editor.js
let editor = fs.readFileSync(path.join(jsDir, 'article-editor.js'), 'utf8');
editor = editor.replace(/window\.authUtils\.checkAuth\(\);\s*/g, '');
editor = editor.replace(/init\(\);/g, 'window.authUtils.checkAuth().then(isAuth => { if(isAuth) init(); });');
fs.writeFileSync(path.join(jsDir, 'article-editor.js'), editor);

console.log("Done fixing admin pages.");
