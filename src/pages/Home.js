import React, { useState } from 'react'
import { v4 as uuidV4 } from "uuid";
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const Home = () => {

  const navigate = useNavigate();

  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");

  //function to create new room id
  const createNewRoom = (e) => {
    e.preventDefault();
    const id = uuidV4();
    setRoomId(id);
    // console.log(id);

    toast.success("Created a new room");
  };

  //function to join room
  const joinRoom = () => {
    if (!roomId || !username) {
      toast.error("ROOM ID & Username is required");
      return;
    }

    //Redirect
    navigate(`/editor/${roomId}`, {
      state: {
        username,
      },
    });
  };

  //function to join by pressing enter key on keyboard
const handleInputEnter = (e) => {
  if (e.code === 'Enter') {
    joinRoom();
  }
}

  return (
    <div className='homePageWrapper'>
      <div className='formwrapper'>
        <img className="homePageLogo" src='/logo.png'/>
        <h4 className='mainLable'>Paste invitation ROOM ID</h4>
        <div className='inputGroup'>
          <input 
          type='text' 
          className='inputBox' 
          placeholder='ROOM ID'
          onChange={(e) => setRoomId(e.target.value)}
          value={roomId}
          onKeyUp={handleInputEnter}
          />

          <input 
          type='text' 
          className='inputBox' 
          placeholder='USERNAME'
          onChange={(e) => setUsername(e.target.value)}
          value={username}
          onKeyUp={handleInputEnter}
          />

          <button className='btn joinBtn' onClick={joinRoom}>Join</button>
          <span className='createInfo'>If you dont have an invite then create &nbsp;
          <a onClick={createNewRoom} href='' className='createNewBtn'>new room</a>
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