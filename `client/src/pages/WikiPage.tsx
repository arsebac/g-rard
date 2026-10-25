import React from 'react';
import { useParams } from 'react-router-dom';
import WikiPage from '../components/wiki/WikiPage';

const WikiPagePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  return (
    <div>
      <h1>Wiki Page</h1>
      <WikiPage slug={slug} />
    </div>
  );
};

export default WikiPagePage;
