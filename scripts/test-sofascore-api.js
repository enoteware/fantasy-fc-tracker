#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

const SOFASCORE_API = {
  key: process.env.RAPIDAPI_KEY,
  host: process.env.RAPIDAPI_HOST
};

async function testEndpoints() {
  // Test 1: Search for a team
  console.log('🔍 Test 1: Search for "Manchester City"...');
  try {
    const searchUrl = `https://${SOFASCORE_API.host}/v1/search/all?q=Manchester%20City`;
    const searchRes = await axios.get(searchUrl, {
      headers: {
        'X-RapidAPI-Key': SOFASCORE_API.key,
        'X-RapidAPI-Host': SOFASCORE_API.host
      }
    });
    
    const teams = searchRes.data.results?.teams || [];
    if (teams.length > 0) {
      console.log('✅ Found teams:');
      teams.slice(0, 3).forEach(t => {
        console.log(`   - ${t.entity.name} (ID: ${t.entity.id})`);
      });
      
      // Test 2: Get upcoming matches for first team
      const teamId = teams[0].entity.id;
      console.log(`\n📅 Test 2: Get upcoming matches for team ${teamId}...`);
      
      const eventsUrl = `https://${SOFASCORE_API.host}/v1/team/${teamId}/events/next/0`;
      const eventsRes = await axios.get(eventsUrl, {
        headers: {
          'X-RapidAPI-Key': SOFASCORE_API.key,
          'X-RapidAPI-Host': SOFASCORE_API.host
        }
      });
      
      const events = eventsRes.data.events || [];
      console.log(`✅ Found ${events.length} upcoming matches:`);
      events.slice(0, 3).forEach(e => {
        const date = new Date(e.startTimestamp * 1000).toISOString().split('T')[0];
        console.log(`   - ${e.homeTeam.name} vs ${e.awayTeam.name} (${date})`);
      });
    } else {
      console.log('❌ No teams found');
    }
  } catch (err) {
    console.log('❌ Error:', err.response?.status, err.message);
  }
}

testEndpoints();
