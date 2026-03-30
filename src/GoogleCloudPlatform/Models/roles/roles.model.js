
const subNavigationSchema = [
  { name: 'title', type: 'STRING' },
]

const navigationSchema = [
  { name: 'title', type: 'STRING', mode: 'REQUIRED' },
  { name: 'type', type: 'STRING', mode: 'REQUIRED' },
  { name: 'sub_navigation', type: 'RECORD', mode: 'REPEATED', fields: subNavigationSchema },
]

const roleSchema = [ 
  { name: 'role_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'role_title', type: 'STRING', mode: 'REQUIRED' },
  { name: 'role_navigation', type: 'RECORD', mode: 'REPEATED', fields: navigationSchema },
]

module.exports = roleSchema

/*
{
  "navigation": [
          {
            "title": 'dashboard',
            "type": 'basic'
          },
          {
            "title": 'clinician',
            "type": 'group'
            "sub_navigation": {
              {
               {
                "title": 'Administration',
                "type": 'basic'
               },   
              }
            }
          },
        ],
}
*/