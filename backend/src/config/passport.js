const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { query } = require('./database');

// JWT Strategy
passport.use(new JwtStrategy({
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET,
}, async (payload, done) => {
  try {
    const result = await query(
      'SELECT id,email,first_name,last_name,role,organization_id,is_active FROM users WHERE id=$1',
      [payload.id]
    );
    if (!result.rows[0] || !result.rows[0].is_active) return done(null, false);
    return done(null, result.rows[0]);
  } catch (err) { return done(err, false); }
}));

// Google OAuth Strategy
// FIXED: New users are created WITHOUT organization_id.
// The googleCallback controller detects this and redirects to /auth/callback?needsOrg=true
// The frontend then shows a "setup organization" step.
passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;

    // Check if user already exists (by google_id OR email)
    const existingUser = await query(
      'SELECT * FROM users WHERE email=$1 OR google_id=$2', [email, profile.id]);

    if (existingUser.rows[0]) {
      const user = existingUser.rows[0];
      if (!user.google_id) {
        await query('UPDATE users SET google_id=$1 WHERE email=$2', [profile.id, email]);
      }
      return done(null, user);
    }

    // New user via Google — create WITHOUT organization (admin will set it up)
    const newUser = await query(`
      INSERT INTO users (first_name,last_name,email,google_id,role,avatar_url)
      VALUES ($1,$2,$3,$4,'admin',$5) RETURNING *
    `, [
      profile.name.givenName  || email.split('@')[0],
      profile.name.familyName || '',
      email,
      profile.id,
      profile.photos?.[0]?.value || null,
    ]);

    return done(null, newUser.rows[0]);
  } catch (err) { return done(err, false); }
}));

module.exports = passport;
