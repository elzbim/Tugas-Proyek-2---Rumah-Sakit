const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const port = 3000;

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Create a MySQL connection
const db = mysql.createConnection({
    host: '127.0.0.1', // Replace with your database host
    user: 'root', // Replace with your database username
    password: '', // Replace with your database password
    database: 'rumahsakit' // Replace with your database name
});

// Connect to the database
db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err.stack);
        return;
    }
    console.log('Connected to the database');
});

// User Registration
app.post('/pendaftaran', (req, res) => {
    let {
        pasien_id,
        nama_pasien,
        tanggal_lahir,
        jenis_kelamin,
        alamat,
        no_ktp,
        no_telepon,
        poliklinik,
        dokter_id,
        tipe_pembayaran,
        tarif
    } = req.body;

    const parsedDokterId = parseInt(dokter_id, 10);
    if (isNaN(parsedDokterId)) {
        return res.status(400).json({ message: 'Invalid dokter_id' });
    }

    const patientQuery = 'INSERT INTO pasien (nama_pasien, tanggal_lahir, jenis_kelamin, alamat, no_ktp, no_telepon) VALUES (?, ?, ?, ?, ?, ?)';
    const registrationQuery = 'INSERT INTO pendaftaran (pasien_id, poliklinik, dokter_id, tanggal_pendaftaran, tipe_pembayaran) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)';

    if (pasien_id === undefined) {
        db.query(patientQuery, [nama_pasien, tanggal_lahir, jenis_kelamin, alamat, no_ktp, no_telepon], (err, patientResult) => {
            if (err) {
                console.error('Error executing patient query:', err.stack);
                res.status(500).send('Error executing patient query');
                return;
            }
            pasien_id = patientResult.insertId;

            // Now insert registration data
            executeRegistrationQuery(pasien_id);
        });
    } else {
        // If pasien_id is provided
        executeRegistrationQuery(pasien_id);
    }

    function executeRegistrationQuery(pasien_id) {
        db.query(registrationQuery, [pasien_id, poliklinik, parsedDokterId, tipe_pembayaran], (err, registrationResult) => {
            if (err) {
                console.error('Error executing registration query:', err.stack);
                res.status(500).send('Error executing registration query');
                return;
            }



            const antrianQuery = 'INSERT INTO antrian (poliklinik_id,layanan_id, pasien_id, dokter_id, tipe_pembayaran, tanggal, waktu) VALUES (?,?,? ,?, ?, CURRENT_DATE, CURRENT_TIME)';
            db.query(antrianQuery, [poliklinik,tarif, pasien_id, parsedDokterId, tipe_pembayaran], (err, antrianResult) => {
                if (err) {
                    console.error('Error executing antrian query:', err.stack);
                    res.status(500).send('Error executing antrian query');
                    return;
                }

                const selectUrutanAntrianQuery = 'SELECT urutan_antrian FROM antrian WHERE antrian_id = ?';
                db.query(selectUrutanAntrianQuery, [antrianResult.insertId], (err, urutanAntrianResult) => {
                    if (err) {
                        console.error('Error executing select urutan_antrian query:', err.stack);
                        res.status(500).send('Error executing select urutan_antrian query');
                        return;
                    }

                    const urutan_antrian = urutanAntrianResult[0].urutan_antrian;

                    



                        res.json({
                            message: 'Registration, rekam medis, and antrian created successfully',
                            registration: {
                                id: registrationResult.insertId,
                                pasien_id: pasien_id,
                                poliklinik: poliklinik,
                                dokter_id: parsedDokterId,
                                tipe_pembayaran: tipe_pembayaran,
                                tanggal_pendaftaran: new Date()
                            },
                            antrian: {
                                id: antrianResult.insertId,
                                poliklinik_id: poliklinik,
                                pasien_id: pasien_id,
                                tipe_pembayaran: tipe_pembayaran,
                                tanggal: new Date(),
                                waktu: new Date(),
                                urutan_antrian: urutan_antrian
                            }
                        });

                    
                });
            });

        });
    }

});




app.post('/register', async (req, res) => {
    const { username, password, dokter_id, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    try {
        let nama_lengkap = req.body.nama_lengkap;

        if (dokter_id) {
            const dokterQuery = 'SELECT nama_dokter FROM dokter WHERE dokter_id = ?';
            db.query(dokterQuery, [dokter_id], async (err, results) => {
                if (err) {
                    console.error('Error executing dokter query:', err.stack);
                    return res.status(500).send('Error executing dokter query');
                }

                if (results.length > 0) {
                    nama_lengkap = results[0].nama_dokter;
                } else {
                    return res.status(400).json({ message: 'Invalid dokter_id' });
                }

                await insertUser(username, password, dokter_id, nama_lengkap, role, res);
            });
        } else {
            await insertUser(username, password, dokter_id, nama_lengkap, role, res);
        }
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).send('Error hashing password');
    }
});

async function insertUser(username, password, dokter_id, nama_lengkap, role, res) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const query = 'INSERT INTO users (username, password, dokter_id, nama_lengkap, role) VALUES (?, ?, ?, ?, ?)';

        db.query(query, [username, hashedPassword, dokter_id, nama_lengkap, role], (err, result) => {
            if (err) {
                console.error('Error executing query:', err.stack);
                return res.status(500).send('Error executing query');
            }
            res.json({ message: 'User registered successfully' });
        });
    } catch (error) {
        console.error('Error hashing password:', error);
        res.status(500).send('Error hashing password');
    }
}

// User Login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const query = 'SELECT * FROM users WHERE username = ?';

    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }

        if (results.length === 0) {
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const user = results[0];

        try {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const token = jwt.sign({ id: user.id, role: user.role }, 'your_jwt_secret', { expiresIn: '1h' });
                res.json({ username: user.username, role: user.role, nama_lengkap: user.nama_lengkap, token, message: 'Login successful' });
            } else {
                res.status(401).json({ message: 'Invalid username or password' });
            }
        } catch (error) {
            console.error('Error comparing password:', error);
            res.status(500).send('Error comparing password');
        }
    });
});

// Create Registration


app.get('/rekamMedis', (req, res) => {
    const query = 'SELECT * FROM rekam_medis';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(results);
    });
})
app.get('/antrian', (req, res) => {
    const query = 'SELECT * FROM antrian';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(results);
    });
})

// Read doctors
app.get('/dokter', (req, res) => {
    const query = 'SELECT * FROM dokter';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(results);
    });
});

app.get('/poliklinik', (req, res) => {
    const query = 'SELECT * FROM poliklinik';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(results);
    });
});

// Read practice schedule
app.get('/jadwalPraktek', (req, res) => {
    const query = 'SELECT * FROM jadwal_praktek';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(results);
    });
});

// Update user
app.put('/users/:id', (req, res) => {
    const { id } = req.params;
    const { name, email, role } = req.body;
    const query = 'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?';
    db.query(query, [name, email, role, id], (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json({ message: 'User updated successfully' });
    });
});

// Delete user
app.delete('/users/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM users WHERE id = ?';
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json({ message: 'User deleted successfully' });
    });
});
// Get pasien
app.get('/pasien/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM pasien WHERE pasien_id = ?';
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    });
});
// Get all pasien
app.get('/pasien', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT * FROM pasien';
    db.query(query, [id], (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    });
});

app.get('/rawatJalan', (req, res) => {
    const query = 'SELECT * FROM rawat_jalan';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})
app.get('/rawatInap', (req, res) => {
    const query = 'SELECT * FROM rawat_inap';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})
app.get('/layanan', (req, res) => {
    const query = 'SELECT * FROM layanan';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})
app.get('/gelang', (req, res) => {
    const query = 'SELECT * FROM gelang';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})
app.get('/tarif', (req, res) => {
    const query = 'SELECT * FROM tarif_pasien';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})

app.get('/obat', (req, res) => {
    const query = 'SELECT * FROM obat';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})
app.get('/resep', (req, res) => {
    const query = 'SELECT * FROM resep';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})
app.get('/kamar', (req, res) => {
    const query = 'SELECT * FROM kamar';
    db.query(query, (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.json(result);
    })
})

app.put('/nextAntrian', (req, res) => {
    const {
        antrianId,
        poliId,
        pasienId,
        dokterId,
        layananId
    } = req.body;

    // Update antrian to mark as finished
    const updateAntrianQuery = 'UPDATE antrian SET selesai = ? WHERE antrian_id = ?';
    db.query(updateAntrianQuery, ['sudah', antrianId], (err, result) => {
        if (err) {
            console.error('Error executing update antrian query:', err.stack);
            return res.status(500).send('Error executing update antrian query');
        }

        // Insert new rekam medis record
        const rekamMedisQuery = 'INSERT INTO rekam_medis (pasien_id, poliklinik_id, dokter_id, waktu_rekam, jenis_rawat) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)';
        db.query(rekamMedisQuery, [pasienId, poliId, dokterId, 'rawat jalan'], (err, rekamMedisResult) => {
            if (err) {
                console.error('Error executing rekam medis query:', err.stack);
                return res.status(500).send('Error executing rekam medis query');
            }

            // Insert new rawat jalan record using the inserted rekam medis ID
            const rawatJalanQuery = 'INSERT INTO rawat_jalan (rekam_medis_id, tanggal_kunjungan) VALUES (?, CURRENT_DATE)';
            db.query(rawatJalanQuery, [rekamMedisResult.insertId], (err, rawatJalanResult) => {
                if (err) {
                    console.error('Error executing rawat jalan query:', err.stack);
                    return res.status(500).send('Error executing rawat jalan query');
                }

                const tarifQuery = 'INSERT INTO tarif_pasien (pasien_id,rekam_medis_id,layanan_id) VALUES (?,?,?)';
                    db.query(tarifQuery, [pasienId,rekamMedisResult.insertId,layananId], (err, tarifResult) => {
                        if (err) {
                            console.error('Error executing tarif query:', err.stack);
                            res.status(500).send('Error executing tarif query');
                            return;
                        }
                // Send success response after all queries succeed
                res.status(200).send('Antrian updated and records inserted successfully');
                    })
            });
        });
    });
});


app.put('/skipAntrian', (req, res) => {
    const {
        antrianId,

    } = req.body
    const query = 'UPDATE antrian SET selesai = ? WHERE antrian_id = ?';
    db.query(query, ['skip', antrianId], (err, result) => {
        if (err) {
            console.error('Error executing query:', err.stack);
            res.status(500).send('Error executing query');
            return;
        }
        res.status(200);
    })
})
 
app.put('/rawatJalanUpdate', (req, res) => {
    const {
        currentRekam,
        activeRow,
        tanggalKunjungan,
        namaDokter,
        poliklinik,
        diagnosis,
        tindakan,
        catatan,
        resep,
        deletedResep,
        layanans,
        deletedLayanans
    } = req.body;

    console.log(req.body);

    const waterfall = new Promise((resolve, reject) => {
        if (resep.length > 0) {
            const queryResep = 'INSERT INTO resep (pasien_id, rekam_medis_id,obat_id, jumlah, dosis) VALUES ?';
            const resepValues = resep.map(medicine => [medicine.pasien_id, medicine.rekam_medis_id, medicine.obat_id, medicine.jumlah, medicine.dosis]);
            console.log(resepValues);
            db.query(queryResep, [resepValues], (err, result) => {
                if (err) {
                    console.error('Error executing query:', err);
                    return reject('Error inserting resep data');
                }
                resolve();
            });
        } else {
            resolve();
        }
    }).then(() => {
        return new Promise((resolve, reject) => {
            if (layanans.length > 0) {
                const queryLayanan = 'INSERT INTO tarif_pasien (pasien_id,rekam_medis_id, layanan_id) VALUES ?';
                const layananPasienValues = layanans.map(layanan => [layanan.layananPasien,layanan.rekam_medis_id, layanan.tarif_id]);
                console.log(layananPasienValues);
                db.query(queryLayanan, [layananPasienValues], (err, result) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        return reject('Error inserting layanan data');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }).then(() => {
        return new Promise((resolve, reject) => {
            if (deletedResep.length > 0) {
                const queryDeleteResep = 'DELETE FROM resep WHERE resep_id IN (?)';
                const resepDeletedValues = deletedResep.map(deletedres => [deletedres]);
                console.log(resepDeletedValues);
                db.query(queryDeleteResep, [resepDeletedValues], (err, result) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        return reject('Error deleting resep data');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }).then(() => {
        return new Promise((resolve, reject) => {
            if (deletedLayanans.length > 0) {
                const queryDeleteLayanan = 'DELETE FROM tarif_pasien WHERE tarif_pasien_id IN (?)';
                const layananDeletedValues = deletedLayanans.map(deletedlay => [deletedlay]);
                db.query(queryDeleteLayanan, [layananDeletedValues], (err, result) => {
                    if (err) {
                        console.error('Error executing query:', err);
                        return reject('Error deleting layanan data');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }).then(() => {
        return new Promise((resolve, reject) => {
            if (tanggalKunjungan !== '') {
                db.query('UPDATE rawat_jalan SET tanggal_kunjungan = ? WHERE rawat_jalan_id = ?', [tanggalKunjungan, activeRow], (err, results) => {
                    if (err) {
                        console.log(err);
                        return reject('Error updating tanggal_kunjungan');
                    }
                    console.log('tanggal');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }).then(() => {
        return new Promise((resolve, reject) => {
            let dokter_id = namaDokter;
            let poliklinik_id = poliklinik;
            let tindakan_medis = tindakan;
            let catatan_perkembangan = catatan;

            const fieldsToUpdate = {
                dokter_id,
                poliklinik_id,
                diagnosis,
                tindakan_medis,
                catatan_perkembangan,
            };
            const setClause = [];
            const values = [];

            for (const [key, value] of Object.entries(fieldsToUpdate)) {
                if (value !== undefined && value !== '' && value !== null) {
                    setClause.push(`${key} = ?`);
                    values.push(value);
                }
            }

            if (setClause.length > 0 && values.length > 0) {
                const sql = `UPDATE rekam_medis SET ${setClause.join(', ')} WHERE rekam_medis_id = ?`;
                values.push(currentRekam);
                db.query(sql, values, (err, results) => {
                    if (err) {
                        console.log(err);
                        return reject('Error updating rekam_medis');
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }).then(() => {
        res.json({ message: 'All operations completed successfully' });
    }).catch(error => {
        res.status(500).send(error);
    });
});

app.post('/switchRawat', (req, res) => {
    const { id } = req.body;

    if (!id) {
        res.status(400).send('ID is required');
        return;
    }

    // Query to get the row with the specified ID
    const selectQuery = 'SELECT * FROM your_table WHERE id = ?';

    connection.query(selectQuery, [id], (err, results) => {
        if (err) {
            console.error('Error fetching the row:', err);
            res.status(500).send('Error fetching the row');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Row not found');
            return;
        }

        // Get the row data
        const row = results[0];

        // Prepare the data for the new row (excluding the 'id' if it's auto-incremented)
        const newRow = { ...row };
        delete newRow.id;

        // Query to insert the new row
        const insertQuery = 'INSERT INTO your_table SET ?';

        connection.query(insertQuery, newRow, (err, results) => {
            if (err) {
                console.error('Error inserting the new row:', err);
                res.status(500).send('Error inserting the new row');
                return;
            }

            res.send(`New row inserted with ID: ${results.insertId}`);
        });
    });
});



// Start the Express server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
