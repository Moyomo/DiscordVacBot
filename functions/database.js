import Sequelize, { BOOLEAN, INTEGER, STRING, TEXT } from 'sequelize';
import sqlite3 from 'sqlite3';
import { error, info } from './logger.js';
const { Database, OPEN_READWRITE, OPEN_CREATE } = sqlite3;

const database = new Database('./database.db', OPEN_READWRITE | OPEN_CREATE, (err) => {
    if (err) {
        error(err);
    }

    database.close((err) => {
        if (err) {
            return error(err);
        }
        info('Closed the database connection.');
    });
});

const sequelize = new Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'database.db',
});

export const suspectModel = sequelize.define('suspect', {
    steam_id: {
        type: STRING,
        primaryKey: true,
        unique: true,
        allowNull: false,
    },
    vac_banned: BOOLEAN,
    community_banned: BOOLEAN,
    economy_banned: STRING,
    days_since_last_ban: {
        type: INTEGER,
        defaultValue: 0,
        allowNull: false,
    },
    vac_amount: INTEGER,
    gameban_amount: INTEGER,
});

export const userModel = sequelize.define('user', {
    discord_id: {
        type: STRING,
        primaryKey: true,
        unique: true,
        allowNull: false,
    },
    notification_type: INTEGER,
    guild_id: STRING,
    channel_id: STRING,
});

export const suspect_to_userModel = sequelize.define('sus2user', {
    s2u_id: {
        type: INTEGER,
        autoIncrement: true,
        primaryKey: true,
        unique: true,
        allowNull: false,
    },
    notes: TEXT,
    ban_types_to_track: INTEGER,
    name: STRING
});

suspectModel.belongsToMany(userModel, {
    through: { model: suspect_to_userModel, unique: false },
    foreignKey: "steam_id",
});
userModel.belongsToMany(suspectModel, {
    through: { model: suspect_to_userModel, unique: false },
    foreignKey: "discord_id",
});