const fs = require('fs');
const path = require('path');
const dir = '/Users/idanmevasem/Desktop/Calcala news/admin';

let leads = fs.readFileSync(path.join(dir, 'leads.html'), 'utf8');
leads = leads.replace(/loadLeads\(\);/g, 'window.authUtils.checkAuth().then(isAuth => { if(isAuth) loadLeads(); });');
fs.writeFileSync(path.join(dir, 'leads.html'), leads);

let quiz = fs.readFileSync(path.join(dir, 'quiz-config.html'), 'utf8');
quiz = quiz.replace(/loadQuizzes\(\);(?=[^]*<\/script>)/g, 'window.authUtils.checkAuth().then(isAuth => { if(isAuth) loadQuizzes(); });'); // Only replace the last call
fs.writeFileSync(path.join(dir, 'quiz-config.html'), quiz);

