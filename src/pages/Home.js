import React from 'react'

const Home = () => {
  return (
    <div className='homePageWrapper'>
      <div className='formwrapper'>
        <img className="homePageLogo" src='/logo.png'/>
        <h4 className='mainLable'>Paste invitation ROOM ID</h4>
        <div className='inputGroup'>
          <input type='text' className='inputBox' placeholder='ROOM ID'/>
          <input type='text' className='inputBox' placeholder='USERNAME'/>
          <button className='btn joinBtn'>Join</button>
          <span className='createInfo'>If you dont have an invite then create &nbsp;
          <a href='' className='createNewBtn'>new room</a>
          </span>
        </div>

      </div>

      <footer>
        <h4>Inspire by{' '} <a href='www.codingninja'>Coding Ninja</a> doubt solving platform </h4>
      </footer>
    </div>
  )
}

export default Home