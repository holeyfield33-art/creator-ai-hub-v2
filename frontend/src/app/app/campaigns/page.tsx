import Link from 'next/link'

export default function CampaignsPage() {
  // Mock campaign data
  const campaigns = [
    { id: 1, name: 'Summer Campaign', status: 'Active', budget: '$5,000' },
    { id: 2, name: 'Product Launch', status: 'Draft', budget: '$10,000' },
    { id: 3, name: 'Brand Awareness', status: 'Completed', budget: '$7,500' },
  ]

  return (
    <div>
      <h1>Campaigns</h1>
      <p style={{ marginTop: '1rem', marginBottom: '1.5rem', color: '#666' }}>
        Manage your AI-powered creator campaigns.
      </p>
      
      <button 
        style={{ 
          padding: '0.75rem 1.5rem', 
          marginBottom: '1.5rem',
          cursor: 'pointer', 
          backgroundColor: '#0070f3', 
          color: 'white', 
          border: 'none', 
          borderRadius: '4px' 
        }}
      >
        + Create Campaign
      </button>

      <div style={{ border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: '#f5f5f5' }}>
            <tr>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                Campaign Name
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                Status
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                Budget
              </th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '1rem' }}>{campaign.name}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    backgroundColor: campaign.status === 'Active' ? '#e6f7e6' : campaign.status === 'Draft' ? '#fff3cd' : '#e6e6e6',
                    color: campaign.status === 'Active' ? '#28a745' : campaign.status === 'Draft' ? '#856404' : '#666',
                  }}>
                    {campaign.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>{campaign.budget}</td>
                <td style={{ padding: '1rem' }}>
                  <button style={{ padding: '0.5rem 1rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                    View
                  </button>
                  <button style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '1.5rem' }}>
        <Link href="/">← Back to Home</Link>
      </p>
    </div>
  )
}
