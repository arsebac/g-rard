import axios from 'axios';

const API_URL = 'http://localhost:3000/api/wiki';

export const searchWikiPage = async (slug: string) => {
  try {
    const response = await axios.get(`${API_URL}/search/${slug}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to search wiki page: ${error.message}`);
  }
};
