const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const socketIO = require('socket.io');
const axios = require('axios');
const path = require('path');

const app = express();
const db = new sqlite3.Database('./chat.db');

// Configurações iniciais
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'supersecret',
        resave: false,
            saveUninitialized: true
            }));

            // Criar tabelas
            db.serialize(() => {
                db.run(`CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                                username TEXT UNIQUE,
                                        password TEXT,
                                                isAdmin BOOLEAN DEFAULT 0,
                                                        profileImage TEXT,
                                                                lastSeen DATETIME
                                                                    )`);
                                                                        
                                                                            db.run(`CREATE TABLE IF NOT EXISTS messages (
                                                                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                                                                            userId INTEGER,
                                                                                                    content TEXT,
                                                                                                            imageUrl TEXT,
                                                                                                                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                                                                                                                            isDeleted BOOLEAN DEFAULT 0
                                                                                                                                )`);
                                                                                                                                });

                                                                                                                                // Middlewares
                                                                                                                                const isAdmin = (req, res, next) => {
                                                                                                                                    if (req.session.user && req.session.user.isAdmin) return next();
                                                                                                                                        res.redirect('/');
                                                                                                                                        };

                                                                                                                                        // Rotas
                                                                                                                                        app.get('/', (req, res) => {
                                                                                                                                            res.sendFile(path.join(__dirname, 'views/index.html'));
                                                                                                                                            });

                                                                                                                                            // Sistema de login/registro (implementar similar para registro)
                                                                                                                                            app.post('/login', async (req, res) => {
                                                                                                                                                const { username, password } = req.body;
                                                                                                                                                    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
                                                                                                                                                            if (user && await bcrypt.compare(password, user.password)) {
                                                                                                                                                                        req.session.user = user;
                                                                                                                                                                                    res.redirect('/chat');
                                                                                                                                                                                            } else {
                                                                                                                                                                                                        res.redirect('/?error=1');
                                                                                                                                                                                                                }
                                                                                                                                                                                                                    });
                                                                                                                                                                                                                    });

                                                                                                                                                                                                                    // Iniciar servidor
                                                                                                                                                                                                                    const server = app.listen(process.env.PORT || 3000, () => {
                                                                                                                                                                                                                        console.log(`Servidor rodando na porta ${server.address().port}`);
                                                                                                                                                                                                                        });

                                                                                                                                                                                                                        // Socket.IO
                                                                                                                                                                                                                        const io = socketIO(server);
                                                                                                                                                                                                                        const onlineUsers = new Map();

                                                                                                                                                                                                                        io.on('connection', (socket) => {
                                                                                                                                                                                                                            socket.on('userOnline', (userId) => {
                                                                                                                                                                                                                                    onlineUsers.set(socket.id, userId);
                                                                                                                                                                                                                                            updateOnlineUsers();
                                                                                                                                                                                                                                                });

                                                                                                                                                                                                                                                    socket.on('disconnect', () => {
                                                                                                                                                                                                                                                            onlineUsers.delete(socket.id);
                                                                                                                                                                                                                                                                    updateOnlineUsers();
                                                                                                                                                                                                                                                                        });

                                                                                                                                                                                                                                                                            socket.on('sendMessage', async (data) => {
                                                                                                                                                                                                                                                                                    // Upload de imagem via 0x0.st
                                                                                                                                                                                                                                                                                            if (data.image) {
                                                                                                                                                                                                                                                                                                        try {
                                                                                                                                                                                                                                                                                                                        const response = await axios.post('https://0x0.st', { file: data.image });
                                                                                                                                                                                                                                                                                                                                        data.imageUrl = response.data;
                                                                                                                                                                                                                                                                                                                                                    } catch (error) {
                                                                                                                                                                                                                                                                                                                                                                    console.error('Erro no upload:', error);
                                                                                                                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                                                                                                                        }

                                                                                                                                                                                                                                                                                                                                                                                                // Salvar mensagem no banco
                                                                                                                                                                                                                                                                                                                                                                                                        db.run(`INSERT INTO messages (userId, content, imageUrl) VALUES (?, ?, ?)`, 
                                                                                                                                                                                                                                                                                                                                                                                                                    [data.userId, data.content, data.imageUrl], (err) => {
                                                                                                                                                                                                                                                                                                                                                                                                                                    if (!err) io.emit('newMessage', data);
                                                                                                                                                                                                                                                                                                                                                                                                                                                });
                                                                                                                                                                                                                                                                                                                                                                                                                                                    });
                                                                                                                                                                                                                                                                                                                                                                                                                                                    });

                                                                                                                                                                                                                                                                                                                                                                                                                                                    function updateOnlineUsers() {
                                                                                                                                                                                                                                                                                                                                                                                                                                                        const users = Array.from(onlineUsers.values());
                                                                                                                                                                                                                                                                                                                                                                                                                                                            io.emit('onlineUsers', users);
                                                                                                                                                                                                                                                                                                                                                                                                                                                            }