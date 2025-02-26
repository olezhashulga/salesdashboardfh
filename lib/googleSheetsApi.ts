const SHEET_ID = '1DH_2A_2Bn7UBSiUOYzq7yMNr_uut1Gc6cQFbsx9EOf8';
const API_KEY = 'AIzaSyD8zF5IwxeH6-nb8WU6T9x_7HYNGE1B5fA';
const RANGE = 'A2:C1000';

export async function fetchSheetData() {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }

    const data = await response.json();
    return data.values || [];
  } catch (error) {
    console.error('Error fetching sheet data:', error);
    return [];
  }
}
